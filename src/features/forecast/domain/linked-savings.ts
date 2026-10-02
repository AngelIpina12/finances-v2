import type { Currency } from "@/src/features/transactions/domain/transaction-repository";
import type { DayCountConvention } from "@/src/features/fixed-income/domain/fixed-income-calculator";
import type { ForecastAccount, ForecastEvent } from "./forecast-calculator";

export type LinkedSavings = {
    positionId: string;
    accountId: string;
    name: string;
    currency: Currency;
    balance: number;
    annualRate: number;
    dayCountConvention: DayCountConvention;
    withholdingRate: number;
    hasDailyInterest: boolean;
};

export type LinkedSavingsMode = "exclude" | "principal" | "with_yield";

export function linkedSavingsAccountId(positionId: string) {
    return `linked-savings:${positionId}`;
}

export function toSavingsAccount(saving: LinkedSavings, id: string, name: string): ForecastAccount {
    return {
        id,
        name,
        type: "fixed_income",
        currency: saving.currency,
        currentBalance: saving.balance,
        creditLimit: null,
        billingDate: null,
        statementBalance: null,
        minimumPayment: null,
        includeInLiquidity: true,
        fundingAccountId: saving.accountId,
    };
}

export function applyLinkedSavings(input: {
    accounts: ForecastAccount[];
    events: ForecastEvent[];
    savings: LinkedSavings[];
    mode: LinkedSavingsMode;
}) {
    if (input.mode === "exclude") {
        return {
            accounts: input.accounts,
            events: input.events.filter((event) => event.linkedSavings?.kind !== "yield"),
        };
    }

    const savingsAccountIds = new Map(input.savings.map((saving) => [
        saving.positionId, linkedSavingsAccountId(saving.positionId),
    ]));
    const events = input.events.flatMap((event): ForecastEvent[] => {
        const savingsAccountId = event.linkedSavings
            ? savingsAccountIds.get(event.linkedSavings.positionId)
            : undefined;
        if (!event.linkedSavings || !savingsAccountId) return [event];

        if (event.linkedSavings.kind === "yield") {
            return input.mode === "with_yield" ? [{ ...event, accountId: savingsAccountId }] : [];
        }

        return [{
            ...event,
            accountId: savingsAccountId,
            settlesAccountId: event.accountId,
            transactionType: "expense",
        }];
    });

    return {
        accounts: [
            ...input.accounts,
            ...input.savings.map((saving) => toSavingsAccount(saving, savingsAccountIds.get(saving.positionId)!, saving.name)),
        ],
        events,
    };
}

export function withSavingsAccounts(accountIds: Set<string>, accounts: Array<Pick<ForecastAccount, "id" | "fundingAccountId">>) {
    const scoped = new Set(accountIds);
    for (const account of accounts) {
        if (account.fundingAccountId && accountIds.has(account.fundingAccountId)) scoped.add(account.id);
    }
    return scoped;
}
