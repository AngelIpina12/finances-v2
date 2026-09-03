import type {
    Currency, TransactionAccount, TransactionType,
} from "@/src/features/transactions/domain/transaction-repository";

export type OccurrenceStatus = "scheduled" | "completed" | "skipped" | "cancelled";

export type ScheduledOccurrence = {
    id: string;
    accountId: string;
    categoryId: string | null;
    transactionType: TransactionType;
    status: OccurrenceStatus;
    name: string;
    amount: number;
    currency: Currency;
    notes: string | null;
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
    transitionOccurrence(
        userId: string,
        occurrenceId: string,
        status: Exclude<OccurrenceStatus, "scheduled">,
        executedAt?: Date,
    ): Promise<boolean>;
}
