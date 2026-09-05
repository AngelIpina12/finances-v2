import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import {
    budgetAllocations, budgets, categories
} from "@/src/db/schema";
import { BudgetError } from "../application/budget-error";
import type { BudgetRepository } from "../domain/budget-repository";
import type { BudgetFormData } from "../schemas/budget.schema";

export class DrizzleBudgetRepository implements BudgetRepository {
    async save(userId: string, input: BudgetFormData) {
        await db.transaction(async (tx) => {
            if (input.allocations.length) {
                const validCategories = await tx
                    .select({ id: categories.id })
                    .from(categories)
                    .where(and(
                        eq(categories.userId, userId),
                        eq(categories.type, "expense"),
                        isNull(categories.deletedAt),
                        inArray(categories.id, input.allocations.map((allocation) => allocation.categoryId)),
                    ));

                if (validCategories.length !== input.allocations.length) {
                    throw new BudgetError("Una categoría seleccionada ya no está disponible.");
                }
            }

            const values = {
                name: input.name,
                amount: String(input.amount),
                currency: input.currency,
                period: input.period,
                rollover: input.rollover,
                isReusable: input.isReusable,
                color: input.color,
                warningThreshold: input.warningThreshold,
                startsAt: input.startsAt,
                endsAt: input.endsAt ?? null,
            };
            let budgetId = input.id;

            if (budgetId) {
                const [updated] = await tx
                    .update(budgets)
                    .set(values)
                    .where(and(
                        eq(budgets.id, budgetId),
                        eq(budgets.userId, userId),
                        isNull(budgets.deletedAt),
                    ))
                    .returning({ id: budgets.id });

                if (!updated) {
                    throw new BudgetError("El presupuesto ya no está disponible.");
                }

                await tx.delete(budgetAllocations).where(eq(budgetAllocations.budgetId, budgetId));
            } else {
                const [created] = await tx
                    .insert(budgets)
                    .values({ userId, ...values })
                    .returning({ id: budgets.id });

                budgetId = created.id;
            }

            if (input.allocations.length) {
                await tx.insert(budgetAllocations).values(input.allocations.map((allocation) => ({
                    budgetId: budgetId!,
                    categoryId: allocation.categoryId,
                    amount: String(allocation.amount),
                })));
            }
        });
    }

    async archive(userId: string, budgetId: string) {
        const [updated] = await db
            .update(budgets)
            .set({ isActive: false, deletedAt: new Date() })
            .where(and(
                eq(budgets.id, budgetId),
                eq(budgets.userId, userId),
                isNull(budgets.deletedAt),
            ))
            .returning({ id: budgets.id });

        return Boolean(updated);
    }
}
