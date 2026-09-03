import type {
    Currency, TransactionAccount, TransactionType,
} from "@/src/features/transactions/domain/transaction-repository";
import type {
    AmountStrategy, CalendarEntry, DateOverride,
    FifthOccurrencePolicy, RecurrenceFrequency,
} from "./recurrence-calculator";

export type RecurringRule = {
    id: string;
    userId: string;
    accountId: string;
    categoryId: string | null;
    transactionType: TransactionType;
    frequency: RecurrenceFrequency;
    amountStrategy: AmountStrategy;
    fifthOccurrencePolicy: FifthOccurrencePolicy;
    name: string;
    amount: number;
    periodTotal: number | null;
    fifthOccurrenceAmount: number | null;
    currency: Currency;
    notes: string | null;
    semimonthlyFirstDay: number | null;
    semimonthlySecondDay: number | null;
    calendarEntries: CalendarEntry[];
    dateOverrides: DateOverride[];
    startsAt: Date;
    endsAt: Date | null;
    isActive: boolean;
};

export type RecurringRuleValues = {
    accountId: string;
    categoryId: string;
    transactionType: TransactionType;
    frequency: RecurrenceFrequency;
    amountStrategy: AmountStrategy;
    fifthOccurrencePolicy: FifthOccurrencePolicy;
    name: string;
    amount: number;
    periodTotal?: number;
    fifthOccurrenceAmount?: number;
    notes?: string;
    semimonthlyFirstDay?: number;
    semimonthlySecondDay?: number;
    calendarEntries?: CalendarEntry[];
    dateOverrides?: DateOverride[];
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
        originalScheduledAt: Date;
        scheduledAt: Date;
        amount: number;
    }>): Promise<number>;
    markGenerated(userId: string, ruleId: string, generatedAt: Date): Promise<void>;
}
