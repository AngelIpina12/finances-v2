import { describe, expect, it } from "vitest";
import { transactionFormSchema } from "./transaction.schema";

const transaction = {
    type: "expense" as const,
    accountId: "00000000-0000-4000-8000-000000000001",
    categoryId: "00000000-0000-4000-8000-000000000002",
    amount: 450,
    date: new Date("2026-09-16T12:00:00.000Z"),
};

describe("transactionFormSchema budget amount", () => {
    it("permite usar sólo una parte del movimiento en el presupuesto", () => {
        const result = transactionFormSchema.safeParse({ ...transaction, budgetAmount: 125 });

        expect(result.success).toBe(true);
        if (result.success) expect(result.data.budgetAmount).toBe(125);
    });

    it("rechaza un importe para presupuesto mayor que el movimiento", () => {
        const result = transactionFormSchema.safeParse({ ...transaction, budgetAmount: 500 });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.issues[0]?.message).toBe(
                "El importe para presupuesto no puede superar el monto del movimiento.",
            );
        }
    });
});
