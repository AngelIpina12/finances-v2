import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/src/db";
import {
    budgetAllocations, budgetPeriods, budgets,
    categories, transactions,
} from "@/src/db/schema";
import { getBudgetPeriodRanges, getRolloverAmount } from "../domain/budget-period";
import { calculateBudgetProgress } from "../domain/budget-progress";

function toNumber(value: string | number | null) {
    return Number(value ?? 0);
}

type BudgetRow = typeof budgets.$inferSelect;
type AllocationRow = typeof budgetAllocations.$inferSelect;

async function getPeriodSpent(
    userId: string,
    budget: BudgetRow,
    allocations: AllocationRow[],
    start: Date,
    end: Date,
) {
    const conditions = [
        eq(transactions.userId, userId),
        eq(transactions.status, "completed"),
        eq(transactions.type, "expense"),
        eq(transactions.currency, budget.currency),
        gte(transactions.date, start),
        lt(transactions.date, end),
    ];

    if (allocations.length) {
        conditions.push(inArray(
            transactions.categoryId,
            allocations.map((allocation) => allocation.categoryId),
        ));
    }

    const ledger = await db
        .select({ amount: transactions.amount })
        .from(transactions)
        .where(and(...conditions));

    return ledger.reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
}

async function syncBudgetPeriods(
    userId: string,
    budget: BudgetRow,
    allocations: AllocationRow[],
    now: Date,
) {
    const ranges = getBudgetPeriodRanges({
        period: budget.period,
        startsAt: budget.startsAt,
        endsAt: budget.endsAt,
        isReusable: budget.isReusable,
    }, now);
    let previousRemaining = 0;
    let current: { start: Date; end: Date; spent: number; rolloverAmount: number } | null = null;

    for (const range of ranges) {
        const spent = await getPeriodSpent(userId, budget, allocations, range.start, range.end);
        const rolloverAmount = getRolloverAmount(budget.rollover, previousRemaining);
        const availableAmount = toNumber(budget.amount) + rolloverAmount;

        await db
            .insert(budgetPeriods)
            .values({
                budgetId: budget.id,
                periodStart: range.start,
                periodEnd: range.end,
                allocatedAmount: budget.amount,
                rolloverAmount: String(rolloverAmount),
            })
            .onConflictDoUpdate({
                target: [
                    budgetPeriods.budgetId,
                    budgetPeriods.periodStart,
                    budgetPeriods.periodEnd,
                ],
                set: {
                    allocatedAmount: budget.amount,
                    rolloverAmount: String(rolloverAmount),
                },
            });

        previousRemaining = availableAmount - spent;

        if (range.start <= now && now < range.end) {
            current = { ...range, spent, rolloverAmount };
        }
    }

    return current;
}

export async function getBudgets(userId: string, now = new Date()) {
    const [rows, expenseCategories] = await Promise.all([
        db.select().from(budgets).where(and(
            eq(budgets.userId, userId),
            eq(budgets.isActive, true),
            isNull(budgets.deletedAt),
        )),
        db.select({ id: categories.id, name: categories.name, color: categories.color })
            .from(categories)
            .where(and(
                eq(categories.userId, userId),
                eq(categories.type, "expense"),
                isNull(categories.deletedAt),
            ))
            .orderBy(categories.sortOrder),
    ]);
    const ids = rows.map((budget) => budget.id);
    const allAllocations = ids.length
        ? await db.select().from(budgetAllocations).where(inArray(budgetAllocations.budgetId, ids))
        : [];

    const items = await Promise.all(rows.map(async (budget) => {
        const allocations = allAllocations.filter((allocation) => allocation.budgetId === budget.id);
        const currentPeriod = await syncBudgetPeriods(userId, budget, allocations, now);
        const allocatedAmount = allocations.reduce(
            (sum, allocation) => sum + toNumber(allocation.amount),
            0,
        );
        const amount = toNumber(budget.amount);
        const availableAmount = amount + (currentPeriod?.rolloverAmount ?? 0);
        const progress = calculateBudgetProgress({
            amount: availableAmount,
            spent: currentPeriod?.spent ?? 0,
            allocatedAmount,
            warningThreshold: budget.warningThreshold,
        });

        return {
            id: budget.id,
            name: budget.name,
            amount,
            availableAmount,
            currency: budget.currency,
            period: budget.period,
            rollover: budget.rollover,
            isReusable: budget.isReusable,
            color: budget.color,
            warningThreshold: budget.warningThreshold,
            startsAt: budget.startsAt,
            endsAt: budget.endsAt,
            periodStart: currentPeriod?.start ?? null,
            periodEnd: currentPeriod?.end ?? null,
            spent: currentPeriod?.spent ?? 0,
            ...progress,
            allocations: allocations.map((allocation) => ({
                categoryId: allocation.categoryId,
                amount: toNumber(allocation.amount),
                categoryName: expenseCategories.find((category) => category.id === allocation.categoryId)?.name
                    ?? "Categoría archivada",
            })),
        };
    }));

    return {
        budgets: items,
        categories: expenseCategories.map((category) => ({
            ...category,
            color: category.color ?? "#64748b",
        })),
    };
}

export type BudgetsData = Awaited<ReturnType<typeof getBudgets>>;
