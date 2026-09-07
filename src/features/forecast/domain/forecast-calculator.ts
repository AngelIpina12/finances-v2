import { getBalanceDelta } from "@/src/features/transactions/domain/transaction-rules";
import type { AccountType, Currency } from "@/src/features/transactions/domain/transaction-repository";
import { startOfMonth, startOfWeek } from "date-fns";

export type ForecastAccount = {
    id: string;
    name: string;
    type: AccountType;
    currency: Currency;
    currentBalance: number;
    creditLimit: number | null;
};

export type ForecastEvent = {
    id: string;
    accountId: string | null;
    source: "scheduled" | "recurring" | "financing";
    name: string;
    amount: number;
    currency: Currency;
    scheduledAt: Date;
    transactionType: "income" | "expense";
    affectsBalance: boolean;
    settlesAccountId?: string | null;
};

export type ForecastAlert = {
    accountId: string;
    kind: "insufficient_funds" | "credit_limit";
    scheduledAt: Date;
    amount: number;
};

export type ProjectedForecastEvent = ForecastEvent & {
    balanceAfter: number | null;
};

export function buildForecast(input: {
    accounts: ForecastAccount[];
    events: ForecastEvent[];
    now: Date;
    days: number;
}) {
    const until = new Date(input.now.getTime() + input.days * 24 * 60 * 60 * 1000);
    const accountsById = new Map(input.accounts.map((account) => [account.id, account]));
    const balances = new Map(input.accounts.map((account) => [account.id, account.currentBalance]));
    const alerts: ForecastAlert[] = [];

    function applyBalanceChange(
        account: ForecastAccount,
        transactionType: ForecastEvent["transactionType"],
        amount: number,
        scheduledAt: Date,
    ) {
        const currentBalance = balances.get(account.id) ?? account.currentBalance;
        const balanceAfter = currentBalance + getBalanceDelta(
            { ...account, owedAmount: null },
            transactionType,
            amount,
        );
        balances.set(account.id, balanceAfter);

        if (account.type === "credit" && account.creditLimit !== null && balanceAfter > account.creditLimit) {
            alerts.push({
                accountId: account.id,
                kind: "credit_limit",
                scheduledAt,
                amount: balanceAfter - account.creditLimit,
            });
        }

        if (account.type !== "credit" && balanceAfter < 0) {
            alerts.push({
                accountId: account.id,
                kind: "insufficient_funds",
                scheduledAt,
                amount: Math.abs(balanceAfter),
            });
        }

        return balanceAfter;
    }

    const events = input.events
        .filter((event) => event.scheduledAt >= input.now && event.scheduledAt < until)
        .sort((left, right) => (
            left.scheduledAt.getTime() - right.scheduledAt.getTime()
            || left.name.localeCompare(right.name)
        ))
        .map((event): ProjectedForecastEvent => {
            const account = event.accountId ? accountsById.get(event.accountId) : undefined;

            if (!event.affectsBalance || !account || account.currency !== event.currency) {
                return { ...event, balanceAfter: null };
            }

            const balanceAfter = applyBalanceChange(
                account,
                event.transactionType,
                event.amount,
                event.scheduledAt,
            );
            const settledAccount = event.settlesAccountId
                ? accountsById.get(event.settlesAccountId)
                : undefined;

            if (settledAccount && settledAccount.currency === event.currency) {
                applyBalanceChange(
                    settledAccount,
                    "income",
                    event.amount,
                    event.scheduledAt,
                );
            }

            return { ...event, balanceAfter };
        });

    const accountSummaries = input.accounts.map((account) => ({
        ...account,
        projectedBalance: balances.get(account.id) ?? account.currentBalance,
    }));

    return { until, events, accounts: accountSummaries, alerts };
}

export function buildCashFlow(
    events: ProjectedForecastEvent[],
    granularity: "week" | "month",
) {
    const groups = new Map<string, {
        label: string;
        incomes: number;
        expenses: number;
    }>();

    for (const event of events) {
        if (!event.affectsBalance) continue;

        const date = event.scheduledAt;
        const periodStart = granularity === "week"
            ? startOfWeek(date, { weekStartsOn: 1 })
            : startOfMonth(date);
        const key = periodStart.toISOString();
        const label = granularity === "week"
            ? `Semana del ${date.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`
            : date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
        const group = groups.get(key) ?? { label, incomes: 0, expenses: 0 };

        if (event.transactionType === "income") group.incomes += event.amount;
        else group.expenses += event.amount;
        groups.set(key, group);
    }

    return [...groups.values()].map((group) => ({
        ...group,
        net: group.incomes - group.expenses,
    }));
}
