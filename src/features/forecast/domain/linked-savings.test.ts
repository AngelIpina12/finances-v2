import {
    describe, expect, it
} from "vitest";
import {
    buildForecast, type ForecastAccount, type ForecastEvent
} from "./forecast-calculator";
import {
    applyLinkedSavings, linkedSavingsAccountId, withSavingsAccounts,
    type LinkedSavingsMode,
} from "./linked-savings";

const now = new Date("2026-09-05T12:00:00.000Z");

const accounts: ForecastAccount[] = [{
    id: "debit", name: "Nu Débito", type: "debit", currency: "MXN",
    currentBalance: 100, creditLimit: null, billingDate: null,
    statementBalance: null, minimumPayment: null, includeInLiquidity: true,
}];

const events: ForecastEvent[] = [
    {
        id: "rent", accountId: "debit", source: "scheduled", name: "Renta",
        amount: 500, currency: "MXN", scheduledAt: new Date("2026-09-06T12:00:00.000Z"),
        transactionType: "expense", affectsBalance: true,
    },
    {
        id: "yield-1", accountId: "debit", source: "fixed_income", name: "Rendimiento estimado · Cajita",
        amount: 10, currency: "MXN", scheduledAt: new Date("2026-09-07T12:00:00.000Z"),
        transactionType: "income", affectsBalance: true,
        linkedSavings: { positionId: "cajita", kind: "yield" },
    },
    {
        id: "principal", accountId: "debit", source: "fixed_income", name: "Capital al vencimiento · Cajita",
        amount: 1000, currency: "MXN", scheduledAt: new Date("2026-09-20T12:00:00.000Z"),
        transactionType: "income", affectsBalance: true,
        linkedSavings: { positionId: "cajita", kind: "principal" },
    },
];

const savings = [{
    positionId: "cajita", accountId: "debit", name: "Cajita", currency: "MXN" as const, balance: 1000,
    annualRate: 0.1, dayCountConvention: "actual_365" as const, withholdingRate: 0, hasDailyInterest: true,
}];

function project(mode: LinkedSavingsMode) {
    const projection = applyLinkedSavings({ accounts, events, savings, mode });
    return {
        projection,
        forecast: buildForecast({ accounts: projection.accounts, events: projection.events, now, days: 30 }),
    };
}

const savingsId = linkedSavingsAccountId("cajita");

function balanceOf(forecast: ReturnType<typeof project>["forecast"], id: string) {
    return forecast.accounts.find((account) => account.id === id)?.projectedBalance;
}

describe("applyLinkedSavings", () => {
    it("sin cajitas ignora el rendimiento reinvertido pero conserva el capital al vencimiento", () => {
        const { projection, forecast } = project("exclude");

        expect(projection.accounts.map((account) => account.id)).toEqual(["debit"]);
        expect(projection.events.map((event) => event.id)).toEqual(["rent", "principal"]);
        expect(balanceOf(forecast, "debit")).toBe(600);
    });

    it("con cajitas proyecta cada una como cuenta propia ligada a su cuenta de fondeo", () => {
        const { projection, forecast } = project("principal");

        expect(projection.accounts[1]).toEqual(expect.objectContaining({
            id: savingsId, name: "Cajita", type: "fixed_income", currentBalance: 1000,
            fundingAccountId: "debit", includeInLiquidity: true,
        }));
        expect(projection.events.map((event) => event.id)).toEqual(["rent", "principal"]);
        expect(balanceOf(forecast, "debit")).toBe(600);
        expect(balanceOf(forecast, savingsId)).toBe(0);
    });

    it("con rendimiento la cajita genera sus intereses diarios", () => {
        const { projection, forecast } = project("with_yield");

        expect(projection.events.find((event) => event.id === "yield-1")?.accountId).toBe(savingsId);
        expect(balanceOf(forecast, "debit")).toBe(600);
        expect(balanceOf(forecast, savingsId)).toBe(10);
    });

    it("hace que las cajitas acompañen a su cuenta en los filtros", () => {
        const scoped = withSavingsAccounts(new Set(["debit"]), [
            { id: savingsId, fundingAccountId: "debit" },
            { id: "otra-cajita", fundingAccountId: "otra-cuenta" },
        ]);

        expect([...scoped]).toEqual(["debit", savingsId]);
    });
});
