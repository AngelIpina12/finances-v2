import type {
    Currency, TransactionAccount,
} from "@/src/features/transactions/domain/transaction-repository";

export type FinancingStatus = "active" | "completed" | "cancelled";

export type FinancingPurchase = {
    id: string;
    accountId: string;
    categoryId: string | null;
    amount: number;
    currency: Currency;
    merchant: string | null;
    date: Date;
};

export type FinancingPlanInput = {
    purchaseTransactionId: string;
    name: string;
    regularInstallmentCount: number;
    regularInstallmentAmount: number;
    balloonAmount: number;
    startsAt: Date;
};

export type FinancingPlan = FinancingPlanInput & {
    id: string;
    userId: string;
    creditAccountId: string;
    totalAmount: number;
    currency: Currency;
    status: FinancingStatus;
};

export type FinancingInstallment = {
    id: string;
    financingPlanId: string;
    sequence: number;
    scheduledAt: Date;
    amount: number;
    isBalloon: boolean;
    paidAt: Date | null;
    scheduledOccurrenceId: string;
    creditAccountId: string;
    currency: Currency;
    planName: string;
    planStatus: FinancingStatus;
};

export type InstallmentDraft = {
    sequence: number;
    scheduledAt: Date;
    amount: number;
    isBalloon: boolean;
};

export interface FinancingRepository {
    withinTransaction<T>(work: (scope: FinancingScope) => Promise<T>): Promise<T>;
}

export interface FinancingScope {
    findEligiblePurchaseForUpdate(userId: string, transactionId: string): Promise<FinancingPurchase | undefined>;
    createPlan(input: FinancingPlanInput & {
        userId: string;
        creditAccountId: string;
        totalAmount: number;
        currency: Currency;
    }): Promise<FinancingPlan>;
    linkPurchaseToPlan(userId: string, purchaseTransactionId: string, planId: string): Promise<boolean>;
    createInstallments(input: {
        plan: FinancingPlan;
        purchase: FinancingPurchase;
        installments: InstallmentDraft[];
    }): Promise<void>;
    findInstallmentForUpdate(userId: string, installmentId: string): Promise<FinancingInstallment | undefined>;
    findAccount(userId: string, accountId: string, options?: { activeOnly?: boolean }): Promise<TransactionAccount | undefined>;
    insertPaymentTransfer(input: {
        userId: string;
        transferGroupId: string;
        installment: FinancingInstallment;
        sourceAccount: TransactionAccount;
        creditAccount: TransactionAccount;
        paidAt: Date;
    }): Promise<void>;
    applyBalanceDelta(account: TransactionAccount, userId: string, delta: number): Promise<boolean>;
    markInstallmentPaid(userId: string, installmentId: string, paidAt: Date, transferGroupId: string): Promise<boolean>;
    completeScheduledOccurrence(userId: string, occurrenceId: string, paidAt: Date): Promise<boolean>;
    completePlanIfPaid(userId: string, planId: string): Promise<void>;
}
