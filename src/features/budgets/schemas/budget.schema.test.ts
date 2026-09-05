import { describe, expect, it } from "vitest";
import { budgetFormSchema } from "./budget.schema";

const categoryA = "11111111-1111-4111-8111-111111111111";
const categoryB = "22222222-2222-4222-8222-222222222222";
const base = {
    name: "Gastos variables",
    amount: 5000,
    currency: "MXN" as const,
    period: "monthly" as const,
    rollover: "disabled" as const,
    isReusable: true,
    color: "#2563eb",
    warningThreshold: 80,
    startsAt: new Date("2026-09-01T06:00:00.000Z"),
};

describe("budgetFormSchema", () => {
    it("permite dejar parte del presupuesto sin asignar", () => {
        expect(budgetFormSchema.safeParse({
            ...base,
            allocations: [{ categoryId: categoryA, amount: 3000 }],
        }).success).toBe(true);
    });

    it("rechaza asignaciones que superan el límite", () => {
        const result = budgetFormSchema.safeParse({
            ...base,
            allocations: [
                { categoryId: categoryA, amount: 3000 },
                { categoryId: categoryB, amount: 3000 },
            ],
        });

        expect(result.success).toBe(false);
    });

    it("rechaza categorías repetidas", () => {
        expect(budgetFormSchema.safeParse({
            ...base,
            allocations: [
                { categoryId: categoryA, amount: 1000 },
                { categoryId: categoryA, amount: 1000 },
            ],
        }).success).toBe(false);
    });

    it("requiere una fecha final para un periodo personalizado", () => {
        expect(budgetFormSchema.safeParse({
            ...base,
            period: "custom",
            allocations: [],
        }).success).toBe(false);
    });
});
