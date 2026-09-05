import {
    and, asc, desc,
    eq, gte, isNull,
    lt, lte, ne,
} from "drizzle-orm";
import { db } from "@/src/db";
import { getBudgets } from "@/src/features/budgets/queries/get-budgets";
import {
    categories, financialAccounts, scheduledOccurrences,
    transactions,
} from "@/src/db/schema";
import {
    addAppCalendarDays, formatAppDate, getAppMonthEnd,
    getAppMonthRange,
} from "@/src/shared/utils/local-date-time";
import type {
    DashboardData, DashboardMetric, MetricTrend,
} from "../types/dashboard.types";

type DashboardRange = ReturnType<typeof getAppMonthRange>;

function toNumber(value: string | null | undefined) {
    return Number(value ?? 0);
}

function comparisonMetric(label: string, current: number, previous: number, options: { lowerIsPositive?: boolean } = {}): DashboardMetric {
    if (previous === 0) {
        return {
            label,
            value: current,
            trend: "neutral",
            trendLabel: "Sin comparación anterior",
            positive: true,
        };
    }

    const difference = current - previous;
    const change = Math.abs((difference / previous) * 100);
    const trend: MetricTrend = difference > 0 ? "up" : difference < 0 ? "down" : "neutral";

    return {
        label,
        value: current,
        trend,
        trendLabel: `${change.toFixed(1)}% vs. mes anterior`,
        positive: options.lowerIsPositive ? difference <= 0 : difference >= 0,
    };
}

export async function getAccountsSummary(userId: string) {
    return db
        .select({
            id: financialAccounts.id,
            name: financialAccounts.name,
            type: financialAccounts.type,
            institution: financialAccounts.institution,
            currentBalance: financialAccounts.currentBalance,
            owedAmount: financialAccounts.owedAmount,
            availableCredit: financialAccounts.availableCredit,
            creditLimit: financialAccounts.creditLimit,
            lastFourDigits: financialAccounts.lastFourDigits,
            includeInNetWorth: financialAccounts.includeInNetWorth,
            createdAt: financialAccounts.createdAt,
        })
        .from(financialAccounts)
        .where(
            and(
                eq(financialAccounts.userId, userId),
                eq(financialAccounts.isActive, true),
                isNull(financialAccounts.deletedAt),
            ),
        )
        .orderBy(desc(financialAccounts.createdAt));
}

export async function getFinancialOverview(userId: string, range: DashboardRange, accountRows: Awaited<ReturnType<typeof getAccountsSummary>>) {
    const movements = await db
        .select({
            type: transactions.type,
            amount: transactions.amount,
            date: transactions.date,
        })
        .from(transactions)
        .where(
            and(
                eq(transactions.userId, userId),
                eq(transactions.status, "completed"),
                ne(transactions.type, "transfer"),
                gte(transactions.date, range.previousStart),
                lt(transactions.date, range.end),
            ),
        );

    const total = (type: "income" | "expense", start: Date, end: Date) => movements
        .filter((movement) => (
            movement.type === type
            && movement.date >= start
            && movement.date < end
        ))
        .reduce((sum, movement) => sum + toNumber(movement.amount), 0);

    const income = total("income", range.start, range.end);
    const expenses = total("expense", range.start, range.end);
    const previousIncome = total("income", range.previousStart, range.start);
    const previousExpenses = total("expense", range.previousStart, range.start);
    const netWorth = accountRows
        .filter((account) => account.includeInNetWorth)
        .reduce((sum, account) => (
            sum + (account.type === "credit"
                ? -toNumber(account.owedAmount ?? account.currentBalance)
                : toNumber(account.currentBalance))
        ), 0);
    const cashFlow = income - expenses;
    const savingsRate = income > 0 ? (cashFlow / income) * 100 : 0;

    return {
        netWorth,
        overview: {
            netWorth: {
                label: "Patrimonio neto",
                value: netWorth,
                trend: "neutral" as const,
                trendLabel: "Saldo actual de tus cuentas",
                positive: netWorth >= 0,
            },
            income: comparisonMetric("Ingresos", income, previousIncome),
            expenses: comparisonMetric("Gastos", expenses, previousExpenses, {
                lowerIsPositive: true,
            }),
            cashFlow: {
                label: "Flujo neto",
                value: cashFlow,
                trend: cashFlow > 0 ? "up" as const : cashFlow < 0 ? "down" as const : "neutral" as const,
                trendLabel: income > 0
                    ? `${savingsRate.toFixed(1)}% de tasa de ahorro`
                    : "Sin ingresos en el periodo",
                positive: cashFlow >= 0,
            },
        },
    };
}

export async function getSpendingByCategory(userId: string, range: DashboardRange) {
    const rows = await db
        .select({
            name: categories.name,
            color: categories.color,
            amount: transactions.amount,
        })
        .from(transactions)
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(
            and(
                eq(transactions.userId, userId),
                eq(transactions.status, "completed"),
                eq(transactions.type, "expense"),
                gte(transactions.date, range.start),
                lt(transactions.date, range.end),
            ),
        );
    const grouped = new Map<string, { name: string; amount: number; color: string }>();

    for (const row of rows) {
        const name = row.name ?? "Sin categoría";
        const current = grouped.get(name) ?? {
            name,
            amount: 0,
            color: row.color ?? "#94a3b8",
        };
        current.amount += toNumber(row.amount);
        grouped.set(name, current);
    }

    const items = [...grouped.values()].sort((a, b) => b.amount - a.amount);
    const total = items.reduce((sum, item) => sum + item.amount, 0);

    return items.slice(0, 6).map((item) => ({
        ...item,
        percentage: total > 0 ? (item.amount / total) * 100 : 0,
    }));
}

export async function getRecentDashboardTransactions(userId: string) {
    const rows = await db
        .select({
            id: transactions.id,
            merchant: transactions.merchant,
            type: transactions.type,
            amount: transactions.amount,
            date: transactions.date,
            category: categories.name,
            account: financialAccounts.name,
        })
        .from(transactions)
        .innerJoin(financialAccounts, eq(transactions.accountId, financialAccounts.id))
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(
            and(
                eq(transactions.userId, userId),
                eq(transactions.status, "completed"),
                ne(transactions.type, "transfer"),
            ),
        )
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(5);

    return rows.map((row) => ({
        merchant: row.merchant ?? row.category ?? "Movimiento",
        category: row.category ?? "Sin categoría",
        account: row.account,
        amount: row.type === "income" ? toNumber(row.amount) : -toNumber(row.amount),
        date: formatAppDate(row.date, {
            day: "numeric",
            month: "short",
        }),
    }));
}

async function getNetWorthHistory(userId: string, currentNetWorth: number, now = new Date()) {
    const monthEnds = Array.from({ length: 6 }, (_, index) => {
        const offset = index - 5;
        const isCurrentMonth = offset === 0;
        const date = isCurrentMonth ? now : getAppMonthEnd(now, offset);

        return {
            date,
            label: formatAppDate(date, { month: "short" })
                .replace(".", ""),
        };
    });
    const ledger = await db
        .select({
            type: transactions.type,
            amount: transactions.amount,
            date: transactions.date,
        })
        .from(transactions)
        .innerJoin(financialAccounts, eq(transactions.accountId, financialAccounts.id))
        .where(
            and(
                eq(transactions.userId, userId),
                eq(transactions.status, "completed"),
                ne(transactions.type, "transfer"),
                eq(financialAccounts.includeInNetWorth, true),
                eq(financialAccounts.isActive, true),
                isNull(financialAccounts.deletedAt),
                gte(transactions.date, monthEnds[0].date),
                lte(transactions.date, now),
            ),
        )
        .orderBy(asc(transactions.date));

    return monthEnds.map((month) => {
        const changesAfterMonth = ledger
            .filter((movement) => movement.date > month.date)
            .reduce((sum, movement) => (
                sum + (movement.type === "income"
                    ? toNumber(movement.amount)
                    : -toNumber(movement.amount))
            ), 0);

        return {
            label: month.label,
            value: currentNetWorth - changesAfterMonth,
        };
    });
}

async function getUpcomingMovements(userId: string, now = new Date()) {
    const until = addAppCalendarDays(now, 45);

    const rows = await db
        .select({
            id: scheduledOccurrences.id,
            name: scheduledOccurrences.name,
            date: scheduledOccurrences.scheduledAt,
            amount: scheduledOccurrences.amount,
            currency: scheduledOccurrences.currency,
            type: scheduledOccurrences.transactionType,
            category: categories.name,
            account: financialAccounts.name,
        })
        .from(scheduledOccurrences)
        .innerJoin(
            financialAccounts,
            eq(scheduledOccurrences.accountId, financialAccounts.id),
        )
        .leftJoin(
            categories,
            eq(scheduledOccurrences.categoryId, categories.id),
        )
        .where(
            and(
                eq(scheduledOccurrences.userId, userId),
                eq(scheduledOccurrences.status, "scheduled"),
                gte(scheduledOccurrences.scheduledAt, now),
                lte(scheduledOccurrences.scheduledAt, until),
            ),
        )
        .orderBy(asc(scheduledOccurrences.scheduledAt))
        .limit(5);

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        date: formatAppDate(row.date, {
            day: "numeric",
            month: "short",
        }),
        amount: toNumber(row.amount),
        currency: row.currency,
        type: row.type as "income" | "expense",
        badge: row.category ?? row.account,
    }));
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
    const now = new Date();
    const range = getAppMonthRange(now);
    const accounts = await getAccountsSummary(userId);
    const overview = await getFinancialOverview(userId, range, accounts);
    const [spendingByCategory, recentTransactions, netWorthHistory, upcomingPayments, budgetData] = await Promise.all([
        getSpendingByCategory(userId, range),
        getRecentDashboardTransactions(userId),
        getNetWorthHistory(userId, overview.netWorth, now),
        getUpcomingMovements(userId, now),
        getBudgets(userId, now),
    ]);
    const featuredAccount = accounts.find((account) => account.type === "credit") ?? accounts[0];

    return {
        periodLabel: formatAppDate(now, {
            month: "long",
            year: "numeric",
        }),
        overview: overview.overview,
        netWorthHistory,
        spendingByCategory,
        budgets: budgetData.budgets.map((budget) => ({
            name: budget.name,
            spent: budget.spent,
            allocated: budget.availableAmount,
            status: budget.status,
        })),
        upcomingPayments,
        account: featuredAccount
            ? {
                name: featuredAccount.name,
                type: featuredAccount.type,
                institution: featuredAccount.institution ?? "Cuenta personal",
                balance: featuredAccount.type === "credit"
                    ? -toNumber(featuredAccount.owedAmount ?? featuredAccount.currentBalance)
                    : toNumber(featuredAccount.currentBalance),
                lastFourDigits: featuredAccount.lastFourDigits ?? "••••",
                availableCredit: toNumber(featuredAccount.availableCredit),
                creditLimit: toNumber(featuredAccount.creditLimit),
            }
            : null,
        goals: [],
        recentTransactions,
    };
}
