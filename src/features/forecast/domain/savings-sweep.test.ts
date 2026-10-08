import {
    describe, expect, it
} from "vitest";
import {
    buildForecast, type ForecastAccount, type ForecastEvent
} from "./forecast-calculator";
import type { LinkedSavings } from "./linked-savings";
import {
    applySavingsSweep, getValidSweepRules, simulatedSavingsAccountId
} from "./savings-sweep";

const now = new Date("2026-10-01T15:00:00.000Z");
const savingsId = simulatedSavingsAccountId("cajita");

const debit: ForecastAccount = {
    id: "debit", name: "Nu Débito", type: "debit", currency: "MXN",
    currentBalance: 100, creditLimit: null, billingDate: null,
    statementBalance: null, minimumPayment: null, includeInLiquidity: true,
};

const saving = (overrides: Partial<LinkedSavings> = {}): LinkedSavings => ({
    positionId: "cajita", accountId: "debit", name: "Cajita", currency: "MXN",
    balance: 1000, annualRate: 0, dayCountConvention: "actual_365", withholdingRate: 0,
    hasDailyInterest: true, ...overrides,
});

function event(id: string, day: number, amount: number): ForecastEvent {
    return {
        id, accountId: "debit", source: "scheduled", name: id, amount: Math.abs(amount),
        currency: "MXN", scheduledAt: new Date(now.getTime() + day * 86_400_000 + 3_600_000),
        transactionType: amount > 0 ? "income" : "expense", affectsBalance: true,
    };
}

function simulate(events: ForecastEvent[], savings: LinkedSavings, minimumBalance = 0) {
    const projection = applySavingsSweep({
        accounts: [debit],
        events,
        savings: [savings],
        mode: "exclude",
        rules: [{ accountId: "debit", positionId: "cajita", minimumBalance }],
        settings: [],
        dismissedCardPaymentKeys: [],
        now,
        days: 10,
    });
    const forecast = buildForecast({ accounts: projection.accounts, events: projection.events, now, days: 10 });
    const balance = (id: string) => forecast.accounts.find((account) => account.id === id)?.projectedBalance;
    return { projection, forecast, balance };
}

describe("applySavingsSweep", () => {
    it("barre cada ingreso a la cajita y retira lo que falte antes de cada pago", () => {
        const { forecast, balance } = simulate([
            event("nomina", 1, 2000),
            event("renta", 2, -1500),
            event("super", 3, -800),
        ], saving());

        expect(balance("debit")).toBe(0);
        expect(balance(savingsId)).toBe(800);
        expect(forecast.events
            .filter((item) => item.source === "savings_simulation")
            .map((item) => [item.name, item.amount])).toEqual([
                ["Traspaso simulado a Cajita", 2100],
                ["Retiro simulado de Cajita", 1500],
                ["Retiro simulado de Cajita", 800],
            ]);
    });

    it("conserva el saldo mínimo en la cuenta", () => {
        const { balance } = simulate([
            event("nomina", 1, 2000),
            event("renta", 2, -1500),
        ], saving(), 500);

        expect(balance("debit")).toBe(500);
        expect(balance(savingsId)).toBe(1100);
    });

    it("deja la cuenta en negativo sólo cuando la cajita se vacía", () => {
        const { balance } = simulate([event("renta", 1, -1500)], saving());

        expect(balance(savingsId)).toBe(0);
        expect(balance("debit")).toBe(-400);
    });

    it("calcula el rendimiento diario sobre el saldo que cambia con cada movimiento", () => {
        const { forecast } = simulate([event("nomina", 0, 36_400)], saving({ annualRate: 0.1, balance: 0 }));
        const yields = forecast.events
            .filter((item) => item.name.startsWith("Rendimiento simulado"))
            .map((item) => item.amount);

        expect(yields[0]).toBe(10);
        expect(yields).toHaveLength(9);
    });

    it("no traspasa ni duplica el rendimiento proyectado de la cajita original", () => {
        const originalYield: ForecastEvent = {
            ...event("rendimiento", 1, 50),
            source: "fixed_income",
            linkedSavings: { positionId: "cajita", kind: "yield" },
        };
        const { projection } = simulate([originalYield], saving());

        expect(projection.events.some((item) => item.id === "rendimiento")).toBe(false);
    });

    it("aplica varias reglas a la vez: cada cuenta cubre sus gastos con su propia cajita", () => {
        const revolut: ForecastAccount = { ...debit, id: "revolut", name: "Revolut Débito", currentBalance: 0 };
        const budget: ForecastEvent = {
            ...event("presupuesto", 2, -700), accountId: "revolut", source: "budget", name: "Presupuesto estimado · Comida",
        };
        const projection = applySavingsSweep({
            accounts: [debit, revolut],
            events: [event("nomina", 1, 2000), budget],
            savings: [saving(), saving({ positionId: "revolut-15", accountId: "revolut", name: "Revolut 15%", balance: 3000 })],
            mode: "exclude",
            rules: [
                { accountId: "debit", positionId: "cajita", minimumBalance: 0 },
                { accountId: "revolut", positionId: "revolut-15", minimumBalance: 0 },
            ],
            settings: [],
            dismissedCardPaymentKeys: [],
            now,
            days: 10,
        });
        const forecast = buildForecast({ accounts: projection.accounts, events: projection.events, now, days: 10 });
        const balance = (id: string) => forecast.accounts.find((account) => account.id === id)?.projectedBalance;

        expect(balance("revolut")).toBe(0);
        expect(balance(simulatedSavingsAccountId("revolut-15"))).toBe(2300);
        expect(balance(savingsId)).toBe(3100);
    });

    it("descarta reglas repetidas o con cajitas que no rinden diario", () => {
        const savings = [saving(), saving({ positionId: "mensual", hasDailyInterest: false })];

        expect(getValidSweepRules([
            { accountId: "debit", positionId: "cajita", minimumBalance: 0 },
            { accountId: "debit", positionId: "cajita", minimumBalance: 100 },
            { accountId: "debit", positionId: "mensual", minimumBalance: 0 },
        ], savings)).toEqual([{ accountId: "debit", positionId: "cajita", minimumBalance: 0 }]);
    });
});
