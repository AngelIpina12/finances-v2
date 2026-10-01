import { describe, expect, it } from "vitest";
import { buildForecast, type ForecastAccount, type ForecastEvent } from "./forecast-calculator";
import {
    buildForecastTimeline, groupTimelineEvents, selectTimelineAccounts, summarizeTimelinePeriod,
} from "./forecast-timeline";

// 30 sep 2026, 00:00 en CDMX.
const startsAt = new Date("2026-09-30T06:00:00.000Z");
const now = new Date("2026-09-30T15:00:00.000Z");

const debit: ForecastAccount = {
    id: "debit", name: "Débito", type: "debit", currency: "MXN",
    currentBalance: 1000, creditLimit: null, billingDate: null,
    statementBalance: null, minimumPayment: null, includeInLiquidity: true,
};
const card: ForecastAccount = {
    ...debit, id: "card", name: "Tarjeta", type: "credit", currentBalance: 300,
    creditLimit: 5000, includeInLiquidity: false,
};

function event(overrides: Partial<ForecastEvent> & Pick<ForecastEvent, "id" | "scheduledAt">): ForecastEvent {
    return {
        accountId: "debit", source: "scheduled", name: overrides.id, amount: 100,
        currency: "MXN", transactionType: "expense", affectsBalance: true,
        ...overrides,
    };
}

const events: ForecastEvent[] = [
    event({ id: "renta", amount: 400, scheduledAt: new Date("2026-09-30T18:00:00.000Z") }),
    event({ id: "nomina", amount: 900, transactionType: "income", scheduledAt: new Date("2026-10-02T18:00:00.000Z") }),
    event({ id: "cafe", accountId: "card", amount: 50, scheduledAt: new Date("2026-10-01T18:00:00.000Z") }),
    event({
        id: "pago-tarjeta", accountId: "debit", settlesAccountId: "card", amount: 350,
        source: "card_payment", scheduledAt: new Date("2026-10-03T18:00:00.000Z"),
    }),
];

function timeline(accountIds: string[], granularity: "day" | "week" = "day") {
    const forecast = buildForecast({ accounts: [debit, card], events, now, days: 5 });
    return buildForecastTimeline({
        accounts: [debit, card],
        events: forecast.events,
        accountIds: new Set(accountIds),
        startsAt,
        endsAt: new Date("2026-10-05T06:00:00.000Z"),
        granularity,
    });
}

describe("buildForecastTimeline", () => {
    it("proyecta el saldo al cierre de cada día desde el saldo inicial", () => {
        const { measure, points } = timeline(["debit"]);

        expect(measure).toBe("balance");
        expect(points.map((point) => point.balance)).toEqual([1000, 600, 600, 1500, 1150, 1150]);
        expect(points.at(-1)).toEqual(expect.objectContaining({ incomes: 900, expenses: 750 }));
    });

    it("muestra la deuda cuando sólo se filtran tarjetas y cuenta el pago como abono", () => {
        const { measure, points } = timeline(["card"]);

        expect(measure).toBe("debt");
        expect(points.map((point) => point.balance)).toEqual([300, 300, 350, 350, 0, 0]);
        expect(points.at(-1)).toEqual(expect.objectContaining({ incomes: 350, expenses: 50 }));
    });

    it("ignora la deuda de tarjetas cuando hay cuentas de débito", () => {
        const { measure, points } = timeline(["debit", "card"]);

        expect(measure).toBe("balance");
        expect(points.map((point) => point.balance)).toEqual([1000, 600, 600, 1500, 1150, 1150]);
        // El pago de la tarjeta sale de débito, así que cuenta como gasto.
        expect(points.at(-1)).toEqual(expect.objectContaining({ incomes: 900, expenses: 750 }));
    });

    it("agrupa por semana con un punto al cierre de cada una", () => {
        // Del miércoles 30 sep al domingo 4 oct es una sola semana.
        const { points } = timeline(["debit"], "week");

        expect(points.map((point) => point.label)).toEqual(["Inicio", "30 sep"]);
        expect(points.map((point) => point.balance)).toEqual([1000, 1150]);
    });

    it("omite el punto de inicio si el primer mes cierra el mismo día", () => {
        const forecast = buildForecast({ accounts: [debit], events, now, days: 5 });
        const { points } = buildForecastTimeline({
            accounts: [debit],
            events: forecast.events,
            accountIds: new Set(["debit"]),
            startsAt,
            endsAt: new Date("2026-10-05T06:00:00.000Z"),
            granularity: "month",
        });

        expect(points.map((point) => point.label)).toEqual(["sep 2026", "oct 2026"]);
    });

    it("sólo grafica tarjetas cuando el filtro no tiene cuentas de activo", () => {
        expect(selectTimelineAccounts([debit, card])).toEqual({ accounts: [debit], measure: "balance" });
        expect(selectTimelineAccounts([card])).toEqual({ accounts: [card], measure: "debt" });
        expect(selectTimelineAccounts([])).toEqual({ accounts: [], measure: "balance" });
    });
    it("calcula lo que cambia en cada periodo además de los acumulados", () => {
        const { points } = timeline(["debit"]);

        expect(points.map((point) => point.balanceChange)).toEqual([null, -400, 0, 900, -350, 0]);
        expect(points.map((point) => [point.periodIncomes, point.periodExpenses])).toEqual([
            [0, 0], [0, 400], [0, 0], [900, 0], [0, 350], [0, 0],
        ]);
    });

    it("conserva el cambio del primer mes aunque se omita el punto de inicio", () => {
        const forecast = buildForecast({ accounts: [debit], events, now, days: 5 });
        const { points } = buildForecastTimeline({
            accounts: [debit],
            events: forecast.events,
            accountIds: new Set(["debit"]),
            startsAt,
            endsAt: new Date("2026-10-05T06:00:00.000Z"),
            granularity: "month",
        });

        // Septiembre cierra con la renta del 30 (1000 → 600).
        expect(points[0]).toEqual(expect.objectContaining({ balanceChange: -400, periodExpenses: 400 }));
        expect(points[1]).toEqual(expect.objectContaining({ balanceChange: 550, periodIncomes: 900, periodExpenses: 350 }));
    });
});

describe("groupTimelineEvents", () => {
    const yieldEvent = (day: number, amount: number) => ({
        ...event({ id: `y${day}`, amount, transactionType: "income", scheduledAt: new Date(Date.UTC(2026, 9, day, 18)) }),
        dailyYieldGroup: "fixed-income:cajita",
        balanceAfter: 1000 + day, settledBalanceAfter: null, liquidityAfter: null,
    });
    const rent = {
        ...event({ id: "renta", amount: 400, scheduledAt: new Date(Date.UTC(2026, 9, 2, 18)) }),
        balanceAfter: 600, settledBalanceAfter: null, liquidityAfter: null,
    };

    it("muestra cada movimiento con agrupación diaria", () => {
        const groups = groupTimelineEvents([yieldEvent(1, 10), rent, yieldEvent(3, 10)], "day");

        expect(groups).toHaveLength(1);
        expect(groups[0].items.map((item) => item.kind)).toEqual(["event", "event", "event"]);
    });

    it("resume los rendimientos diarios de cada periodo en una fila", () => {
        const groups = groupTimelineEvents([
            yieldEvent(1, 10), rent, yieldEvent(3, 10.5), yieldEvent(32, 11),
        ], "month");

        expect(groups.map((group) => group.label)).toEqual(["octubre de 2026", "noviembre de 2026"]);
        // El resumen se ordena en su último día (3 oct), después de la renta del 2.
        expect(groups[0].items).toEqual([
            expect.objectContaining({ kind: "event" }),
            expect.objectContaining({ kind: "daily_yield", days: 2, amount: 20.5 }),
        ]);
        expect(groups[1].items).toEqual([expect.objectContaining({ kind: "daily_yield", days: 1, amount: 11 })]);
    });
});

describe("summarizeTimelinePeriod", () => {
    it("resume por cuenta ingresos, gastos, pagos de tarjeta, traspasos y saldo al cierre", () => {
        const savings: ForecastAccount = { ...debit, id: "cajita", name: "Cajita", type: "fixed_income", currentBalance: 0 };
        const forecast = buildForecast({
            accounts: [debit, card, savings],
            events: [
                ...events,
                event({ id: "traspaso", settlesAccountId: "cajita", amount: 500, scheduledAt: new Date("2026-10-02T19:00:00.000Z") }),
                {
                    ...event({ id: "rendimiento", accountId: "cajita", amount: 2, transactionType: "income", scheduledAt: new Date("2026-10-03T12:00:00.000Z") }),
                    dailyYieldGroup: "fixed-income:cajita",
                },
            ],
            now,
            days: 5,
        });
        // La renta del 30 sep cae en septiembre; se resume octubre.
        const [, period] = groupTimelineEvents(forecast.events, "month");
        const summary = summarizeTimelinePeriod(period.items, new Map([
            ["debit", "debit"], ["card", "credit"], ["cajita", "fixed_income"],
        ]));

        expect(summary).toEqual(expect.arrayContaining([
            expect.objectContaining({
                accountId: "debit", incomes: 900, expenses: 350, transfersOut: 500, closingBalance: 650,
            }),
            expect.objectContaining({ accountId: "card", incomes: 350, expenses: 50, closingBalance: 0 }),
            expect.objectContaining({ accountId: "cajita", transfersIn: 500, yields: 2, closingBalance: 502 }),
        ]));
    });

    it("fusiona la cuenta del ahorro automático en su cajita sin contar sus traspasos", () => {
        const savings: ForecastAccount = { ...debit, id: "cajita", name: "Cajita", type: "fixed_income", currentBalance: 0 };
        const forecast = buildForecast({
            accounts: [debit, card, savings],
            events: [
                ...events,
                event({ id: "traspaso", settlesAccountId: "cajita", amount: 500, scheduledAt: new Date("2026-10-02T19:00:00.000Z") }),
            ],
            now,
            days: 5,
        });
        const [, period] = groupTimelineEvents(forecast.events, "month");
        const summary = summarizeTimelinePeriod(
            period.items,
            new Map([["debit", "debit"], ["card", "credit"], ["cajita", "fixed_income"]]),
            new Map([["debit", "cajita"]]),
        );

        expect(summary.some((item) => item.accountId === "debit")).toBe(false);
        expect(summary).toEqual(expect.arrayContaining([expect.objectContaining({
            accountId: "cajita", incomes: 900, expenses: 350, transfersIn: 0, transfersOut: 0,
            closingBalance: 500, mergedBalances: [{ accountId: "debit", balance: 650 }],
        })]));
    });
});
