import { describe, expect, it } from "vitest";
import { calculateBudgetProgress } from "./budget-progress";

describe("calculateBudgetProgress", () => {
    it("calcula disponibilidad y monto sin asignar", () => {
        expect(calculateBudgetProgress({
            amount: 5000,
            spent: 1800,
            allocatedAmount: 4000,
            warningThreshold: 80,
        })).toEqual({
            usage: 36,
            remaining: 3200,
            unallocatedAmount: 1000,
            status: "healthy",
        });
    });

    it("marca advertencia al alcanzar el umbral configurado", () => {
        expect(calculateBudgetProgress({
            amount: 5000,
            spent: 4000,
            allocatedAmount: 5000,
            warningThreshold: 80,
        }).status).toBe("warning");
    });

    it("marca excedido y conserva el restante negativo", () => {
        expect(calculateBudgetProgress({
            amount: 5000,
            spent: 5200,
            allocatedAmount: 5000,
            warningThreshold: 80,
        })).toMatchObject({
            remaining: -200,
            unallocatedAmount: 0,
            status: "exceeded",
        });
    });
});
