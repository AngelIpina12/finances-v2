import type {
    Currency, TransactionAccount, TransactionType,
} from "@/src/features/transactions/domain/transaction-repository";
import type { RecurrenceFrequency } from "./recurrence-calculator";

export type RecurringRule = {
    id: string;
    userId: string;
    accountId: string;
    categoryId: string | null;
    transactionType: TransactionType;
    frequency: RecurrenceFrequency;
    name: string;
    amount: number;
    currency: Currency;
    notes: string | null;
    startsAt: Date;
    endsAt: Date | null;
    isActive: boolean;
};

export type RecurringRuleValues = {
    accountId: string;
    categoryId: string;
    transactionType: TransactionType;
    frequency: RecurrenceFrequency;
    name: string;
    amount: number;
    notes?: string;
    startsAt: Date;
    endsAt?: Date;
};

export interface RecurringRuleRepository {
    withinTransaction<T>(work: (scope: RecurringRuleScope) => Promise<T>): Promise<T>;
}

export interface RecurringRuleScope {
    findAccount(
        userId: string,
        accountId: string,
        options?: { activeOnly?: boolean },
    ): Promise<TransactionAccount | undefined>;
    categoryBelongsToType(
        userId: string,
        categoryId: string,
        type: TransactionType,
    ): Promise<boolean>;
    createRule(input: RecurringRuleValues & {
        userId: string;
        currency: Currency;
    }): Promise<RecurringRule>;
    findRuleForUpdate(userId: string, ruleId: string): Promise<RecurringRule | undefined>;
    updateRule(
        userId: string,
        ruleId: string,
        input: RecurringRuleValues & { currency: Currency },
    ): Promise<RecurringRule | undefined>;
    setActive(userId: string, ruleId: string, isActive: boolean): Promise<RecurringRule | undefined>;
    archiveRule(userId: string, ruleId: string): Promise<boolean>;
    findActiveRules(userId: string, ruleId?: string): Promise<RecurringRule[]>;
    insertGeneratedOccurrences(input: Array<{
        rule: RecurringRule;
        sequence: number;
        scheduledAt: Date;
    }>): Promise<number>;
    markGenerated(userId: string, ruleId: string, generatedAt: Date): Promise<void>;
}
