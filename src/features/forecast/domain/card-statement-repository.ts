import type { Currency, TransactionAccount } from "@/src/features/transactions/domain/transaction-repository";

export type CardStatementCard = {
    id: string;
    name: string;
    currency: Currency;
    billingDate: number;
};

export type UnpaidInstallment = {
    id: string;
    financingPlanId: string;
    scheduledOccurrenceId: string;
    amount: number;
};

export interface CardStatementScope {
    findCard(userId: string, creditAccountId: string): Promise<CardStatementCard | undefined>;
    findAccount(userId: string, accountId: string, options?: { activeOnly?: boolean }): Promise<TransactionAccount | undefined>;
    getPaymentTermDays(userId: string, creditAccountId: string): Promise<number | undefined>;
    sumRegularCharges(userId: string, creditAccountId: string, cycleStartsAt: Date, closesAt: Date): Promise<number>;
    sumCycleCredits(userId: string, creditAccountId: string, cycleStartsAt: Date, closesAt: Date): Promise<number>;
    sumPaymentsSinceClose(userId: string, creditAccountId: string, closesAt: Date, now: Date): Promise<number>;
    findUnpaidInstallmentsDue(userId: string, creditAccountId: string, dueAt: Date): Promise<UnpaidInstallment[]>;
    insertStatementPayment(input: {
        userId: string;
        transferGroupId: string;
        card: CardStatementCard;
        sourceAccount: TransactionAccount;
        amount: number;
        paidAt: Date;
    }): Promise<void>;
    applyBalanceDelta(account: TransactionAccount, userId: string, delta: number): Promise<boolean>;
    markInstallmentsPaid(userId: string, installmentIds: string[], paidAt: Date, transferGroupId: string): Promise<number>;
    completeScheduledOccurrences(userId: string, occurrenceIds: string[], paidAt: Date): Promise<number>;
    completePlansIfPaid(userId: string, planIds: string[]): Promise<void>;
}

export interface CardStatementRepository {
    withinTransaction<T>(work: (scope: CardStatementScope) => Promise<T>): Promise<T>;
}
