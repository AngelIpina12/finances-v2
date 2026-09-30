import { describe, expect, it } from "vitest";
import { buildForecast, type ForecastAccount, type ForecastEvent } from "./forecast-calculator";
import { applyLinkedSavings, type LinkedSavingsMode } from "./linked-savings";

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

const savings = [{ positionId: "cajita", accountId: "debit", name: "Cajita", currency: "MXN" as const, balance: 1000 }];

function project(mode: LinkedSavingsMode) {
    const projection = applyLinkedSavings({ accounts, events, savings, mode });
    return {
        projection,
        forecast: buildForecast({ accounts: projection.accounts, events: projection.events, now, days: 30 }),
    };
}

describe("applyLinkedSavings", () => {
    it("sin cajitas ignora el rendimiento reinvertido pero conserva el capital al vencimiento", () => {
        const { projection, forecast } = project("exclude");

        expect(projection.accounts[0]?.linkedSavingsBalance).toBeUndefined();
        expect(projection.events.map((event) => event.id)).toEqual(["rent", "principal"]);
        expect(forecast.accounts[0]?.projectedBalance).toBe(600);
    });

    it("con cajitas suma su saldo a la cuenta de fondeo sin duplicar el capital", () => {
        const { projection, forecast } = project("principal");

        expect(projection.accounts[0]).toEqual(expect.objectContaining({
            currentBalance: 1100, linkedSavingsBalance: 1000,
        }));
        expect(projection.events.map((event) => event.id)).toEqual(["rent"]);
        expect(forecast.accounts[0]?.projectedBalance).toBe(600);
    });

    it("con rendimiento suma además los intereses diarios proyectados", () => {
        const { projection, forecast } = project("with_yield");

        expect(projection.events.map((event) => event.id)).toEqual(["rent", "yield-1"]);
        expect(forecast.accounts[0]?.projectedBalance).toBe(610);
    });
});
