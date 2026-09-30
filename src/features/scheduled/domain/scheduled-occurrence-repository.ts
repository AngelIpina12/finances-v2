import type {
    Currency, TransactionAccount, TransactionType,
} from "@/src/features/transactions/domain/transaction-repository";

export type OccurrenceStatus = "scheduled" | "completed" | "skipped" | "cancelled";

export type ScheduledOccurrence = {
    id: string;
    source: "manual" | "recurring_rule" | "financing_installment";
    recurringRuleId: string | null;
    accountId: string;
    categoryId: string | null;
    transactionType: TransactionType;
    status: OccurrenceStatus;
    name: string;
    amount: number;
    currency: Currency;
    notes: string | null;
    originalScheduledAt: Date;
    scheduledAt: Date;
};

export type CreateScheduledOccurrenceCommand = {
    accountId: string;
    categoryId: string;
    transactionType: TransactionType;
    name: string;
    amount: number;
    scheduledAt: Date;
    notes?: string;
};

export interface ScheduledOccurrenceRepository {
    withinTransaction<T>(
        work: (scope: ScheduledOccurrenceScope) => Promise<T>,
    ): Promise<T>;
}

export interface ScheduledOccurrenceScope {
    findAccount(
        userId: string,
        accountId: string,
        options?: { activeOnly?: boolean },
    ): Promise<TransactionAccount | undefined>;
    categoryBelongsToType(
        userId: string,
        categoryId: string,
        type: TransactionType,
        options?: { activeOnly?: boolean },
    ): Promise<boolean>;
    findOccurrenceForUpdate(
        userId: string,
        occurrenceId: string,
    ): Promise<ScheduledOccurrence | undefined>;
    insertOccurrence(input: {
        userId: string;
        accountId: string;
        categoryId: string;
        transactionType: TransactionType;
        name: string;
        amount: number;
        currency: Currency;
        notes?: string;
        scheduledAt: Date;
    }): Promise<void>;
    insertCompletedTransaction(input: {
        userId: string;
        occurrence: ScheduledOccurrence;
        executedAt: Date;
    }): Promise<void>;
    applyBalanceDelta(
        account: TransactionAccount,
        userId: string,
        delta: number,
    ): Promise<boolean>;
    rescheduleOccurrence(
        userId: string,
        occurrenceId: string,
        scheduledAt: Date,
    ): Promise<boolean>;
    /**
     * Guarda el cambio de fecha en la regla para que sobreviva cuando sus
     * ocurrencias pendientes se regeneren. Devuelve false si la regla ya no
     * admite esa fecha (por ejemplo, porque termina antes).
     */
    recordRuleDateOverride(input: {
        userId: string;
        ruleId: string;
        originalScheduledAt: Date;
        scheduledAt: Date;
    }): Promise<boolean>;
    transitionOccurrence(
        userId: string,
        occurrenceId: string,
        status: Exclude<OccurrenceStatus, "scheduled">,
        executedAt?: Date,
    ): Promise<boolean>;
}
