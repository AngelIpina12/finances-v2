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
    /** Sólo las cajitas con rendimiento diario pueden simular ahorro automático. */
    hasDailyInterest: boolean;
};

export type LinkedSavingsMode = "exclude" | "principal" | "with_yield";

export function linkedSavingsAccountId(positionId: string) {
    return `linked-savings:${positionId}`;
}

/** Proyecta una cajita como cuenta propia, ligada a su cuenta de fondeo. */
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

/**
 * Ajusta cuentas y eventos según cómo se quieran contemplar las cajitas:
 * - exclude: las cajitas no aparecen; las cuentas muestran sólo su dinero.
 * - principal: cada cajita aparece como cuenta propia con su saldo actual.
 * - with_yield: además, cada cajita genera su rendimiento diario proyectado.
 */
export function applyLinkedSavings(input: {
    accounts: ForecastAccount[];
    events: ForecastEvent[];
    savings: LinkedSavings[];
    mode: LinkedSavingsMode;
}) {
    if (input.mode === "exclude") {
        // El rendimiento se queda en la cajita; sólo el capital que vence llega a una cuenta.
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

        // Al vencer, el capital sale de la cajita hacia la cuenta que lo recibe.
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

/** Las cajitas acompañan a su cuenta de fondeo cuando ésta se filtra. */
export function withSavingsAccounts(accountIds: Set<string>, accounts: Array<Pick<ForecastAccount, "id" | "fundingAccountId">>) {
    const scoped = new Set(accountIds);
    for (const account of accounts) {
        if (account.fundingAccountId && accountIds.has(account.fundingAccountId)) scoped.add(account.id);
    }
    return scoped;
}
