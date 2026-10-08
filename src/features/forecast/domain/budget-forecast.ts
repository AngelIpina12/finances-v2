import { subDays } from "date-fns";
import { getBudgetPeriodRanges } from "@/src/features/budgets/domain/budget-period";
import type { ForecastEvent } from "./forecast-calculator";

export type ForecastBudget = {
    id: string;
    name: string;
    amount: number;
    currency: ForecastEvent["currency"];
    startsAt: Date;
    endsAt: Date | null;
    isReusable: boolean;
    forecastAccountId: string;
    categoryIds: string[];
};

export type BudgetExpense = {
    categoryId: string | null;
    currency: string;
    date: Date;
    amount: number;
};

export function buildBudgetForecastEvents(input: {
    budgets: ForecastBudget[]; expenses: BudgetExpense[]; now: Date;
    until: Date;
}): ForecastEvent[] {
    const events: ForecastEvent[] = [];

    for (const budget of input.budgets) {
        const ranges = getBudgetPeriodRanges({
            period: "monthly",
            startsAt: budget.startsAt,
            endsAt: budget.endsAt,
            isReusable: budget.isReusable,
        }, input.until);
        const categoryIds = new Set(budget.categoryIds);

        for (const range of ranges) {
            if (range.end <= input.now) continue;
            if (budget.endsAt && range.start >= budget.endsAt) break;

            const isCurrent = range.start <= input.now;
            const spent = isCurrent
                ? input.expenses
                    .filter((expense) => (
                        expense.currency === budget.currency
                        && expense.date >= range.start
                        && expense.date < range.end
                        && (categoryIds.size === 0
                            || (expense.categoryId !== null && categoryIds.has(expense.categoryId)))
                    ))
                    .reduce((sum, expense) => sum + expense.amount, 0)
                : 0;
            const amount = Math.round(Math.max(0, budget.amount - spent) * 100) / 100;
            const lastDay = subDays(range.end, 1);
            const scheduledAt = lastDay < input.now ? input.now : lastDay;

            if (amount <= 0 || scheduledAt >= input.until) continue;

            events.push({
                id: `budget:${budget.id}:${range.start.toISOString()}`,
                accountId: budget.forecastAccountId,
                source: "budget",
                name: `Presupuesto estimado · ${budget.name}`,
                amount,
                currency: budget.currency,
                scheduledAt,
                transactionType: "expense",
                affectsBalance: true,
            });
        }
    }

    return events;
}
