import { and, desc, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { db } from "@/src/db";
import {
    budgetAllocations, budgetPeriods, budgets,
    categories, financialAccounts, transactions,
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
        .select({
            id: transactions.id,
            date: transactions.date,
            merchant: transactions.merchant,
            description: transactions.description,
            amount: transactions.amount,
            budgetAmount: transactions.budgetAmount,
            categoryName: categories.name,
            accountName: financialAccounts.name,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .innerJoin(financialAccounts, eq(transactions.accountId, financialAccounts.id))
        .where(and(...conditions))
        .orderBy(desc(transactions.date));

    const expenses = ledger.map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        merchant: transaction.merchant,
        description: transaction.description,
        categoryName: transaction.categoryName,
        accountName: transaction.accountName,
        amount: toNumber(transaction.amount),
        budgetAmount: toNumber(transaction.budgetAmount ?? transaction.amount),
    }));

    return {
        spent: expenses.reduce((sum, expense) => sum + expense.budgetAmount, 0),
        expenses,
    };
}

type PeriodExpense = Awaited<ReturnType<typeof getPeriodSpent>>["expenses"][number];

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
    let current: {
        start: Date;
        end: Date;
        spent: number;
        rolloverAmount: number;
        expenses: PeriodExpense[];
    } | null = null;

    for (const range of ranges) {
        const { spent, expenses } = await getPeriodSpent(userId, budget, allocations, range.start, range.end);
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
            current = { ...range, spent, rolloverAmount, expenses };
        }
    }

    return current;
}

export async function getBudgets(userId: string, now = new Date()) {
    const [rows, expenseCategories, accounts] = await Promise.all([
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
        db.select({ id: financialAccounts.id, name: financialAccounts.name, currency: financialAccounts.currency })
            .from(financialAccounts)
            .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true), isNull(financialAccounts.deletedAt)))
            .orderBy(financialAccounts.name),
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
            forecastAccountId: budget.forecastAccountId,
            includeInForecast: budget.includeInForecast,
            periodStart: currentPeriod?.start ?? null,
            periodEnd: currentPeriod?.end ?? null,
            spent: currentPeriod?.spent ?? 0,
            expenses: currentPeriod?.expenses ?? [],
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
        accounts,
    };
}

export type BudgetsData = Awaited<ReturnType<typeof getBudgets>>;
