import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
    budgetPeriods, budgets, categories,
    financialAccounts, transactions, users,
} from "@/src/db/schema";
import { getBudgets } from "./get-budgets";

const userIds: string[] = [];

afterEach(async () => {
    await Promise.all(userIds.splice(0).map((id) => (
        db.delete(users).where(eq(users.id, id))
    )));
});

describe("getBudgets integration", () => {
    it("sólo suma gastos completados de la moneda y categoría del presupuesto", async () => {
        const userId = crypto.randomUUID();
        const categoryId = crypto.randomUUID();
        userIds.push(userId);

        await db.insert(users).values({
            id: userId,
            name: "Integration Test",
            email: `${userId}@example.test`,
        });
        const [account] = await db.insert(financialAccounts).values({
            userId,
            name: "Cuenta test",
            type: "debit",
            currency: "MXN",
        }).returning({ id: financialAccounts.id });
        await db.insert(categories).values({
            id: categoryId,
            userId,
            name: "Comida test",
            type: "expense",
            color: "#2563eb",
            iconUrl: "shopping-cart",
        });
        const [budget] = await db.insert(budgets).values({
            userId,
            name: "Presupuesto test",
            amount: "5000",
            currency: "MXN",
            period: "monthly",
            rollover: "disabled",
            startsAt: new Date("2026-09-01T06:00:00.000Z"),
        }).returning({ id: budgets.id });
        await db.insert(transactions).values([
            {
                userId,
                accountId: account.id,
                categoryId,
                type: "expense",
                status: "completed",
                amount: "1200",
                currency: "MXN",
                date: new Date("2026-09-02T18:00:00.000Z"),
            },
            {
                userId,
                accountId: account.id,
                categoryId,
                type: "expense",
                status: "completed",
                amount: "999",
                currency: "USD",
                date: new Date("2026-09-02T18:00:00.000Z"),
            },
            {
                userId,
                accountId: account.id,
                type: "transfer",
                status: "completed",
                amount: "500",
                currency: "MXN",
                transferDirection: "out",
                date: new Date("2026-09-02T18:00:00.000Z"),
            },
        ]);

        const result = await getBudgets(userId, new Date("2026-09-05T18:00:00.000Z"));

        expect(result.budgets[0]).toMatchObject({
            id: budget.id,
            spent: 1200,
            remaining: 3800,
        });
        expect(await db.select().from(budgetPeriods).where(eq(budgetPeriods.budgetId, budget.id))).toHaveLength(1);
    });
});
