import { describe, expect, it } from "vitest";
import { buildBudgetForecastEvents, type ForecastBudget } from "./budget-forecast";

const budget: ForecastBudget = {
    id: "mama",
    name: "Mamá",
    amount: 3200,
    currency: "MXN",
    startsAt: new Date("2026-08-15T06:00:00.000Z"),
    endsAt: null,
    isReusable: true,
    forecastAccountId: "credit",
    categoryIds: ["mandado"],
};

const now = new Date("2026-10-06T18:00:00.000Z");
const until = new Date("2026-12-31T06:00:00.000Z");

describe("buildBudgetForecastEvents", () => {
    it("proyecta sólo lo que falta del periodo en curso en su último día", () => {
        const events = buildBudgetForecastEvents({
            budgets: [budget],
            expenses: [
                { categoryId: "mandado", currency: "MXN", date: new Date("2026-09-20T06:00:00.000Z"), amount: 1000 },
                { categoryId: "mandado", currency: "MXN", date: new Date("2026-09-10T06:00:00.000Z"), amount: 900 },
                { categoryId: "otra", currency: "MXN", date: new Date("2026-09-20T06:00:00.000Z"), amount: 700 },
                { categoryId: "mandado", currency: "USD", date: new Date("2026-09-20T06:00:00.000Z"), amount: 50 },
            ],
            now,
            until,
        });

        expect(events.map((event) => [event.scheduledAt.toISOString(), event.amount])).toEqual([
            ["2026-10-14T06:00:00.000Z", 2200],
            ["2026-11-14T06:00:00.000Z", 3200],
            ["2026-12-14T06:00:00.000Z", 3200],
        ]);
    });

    it("omite el periodo en curso cuando ya se gastó todo el presupuesto", () => {
        const events = buildBudgetForecastEvents({
            budgets: [budget],
            expenses: [
                { categoryId: "mandado", currency: "MXN", date: new Date("2026-09-16T06:00:00.000Z"), amount: 3564.55 },
            ],
            now,
            until,
        });

        expect(events[0]?.scheduledAt.toISOString()).toBe("2026-11-14T06:00:00.000Z");
        expect(events[0]?.amount).toBe(3200);
    });

    it("cuenta cualquier gasto cuando el presupuesto no tiene categorías asignadas", () => {
        const events = buildBudgetForecastEvents({
            budgets: [{ ...budget, categoryIds: [] }],
            expenses: [
                { categoryId: "otra", currency: "MXN", date: new Date("2026-09-20T06:00:00.000Z"), amount: 700 },
            ],
            now,
            until,
        });

        expect(events[0]?.amount).toBe(2500);
    });

    it("mueve a hoy el restante cuando el último día del periodo ya empezó", () => {
        const lastDay = new Date("2026-10-14T18:00:00.000Z");
        const events = buildBudgetForecastEvents({
            budgets: [budget],
            expenses: [],
            now: lastDay,
            until,
        });

        expect(events[0]?.scheduledAt).toEqual(lastDay);
    });

    it("no proyecta periodos que empiezan después del fin del presupuesto", () => {
        const events = buildBudgetForecastEvents({
            budgets: [{ ...budget, endsAt: new Date("2026-11-15T06:00:00.000Z") }],
            expenses: [],
            now,
            until,
        });

        expect(events).toHaveLength(2);
    });
});
