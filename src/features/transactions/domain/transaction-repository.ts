export type TransactionType = "income" | "expense";
export type LedgerTransactionType = TransactionType | "transfer";
export type TransferDirection = "in" | "out";
export type AccountType =
    | "cash"
    | "debit"
    | "credit"
    | "wallet"
    | "investment"
    | "fixed_income"
    | "loan";
export type Currency = "MXN" | "USD" | "EUR" | "GBP";

export type TransactionValues = {
    accountId: string;
    categoryId: string;
    type: TransactionType;
    amount: number;
    date: Date;
    merchant?: string;
    notes?: string;
    allowCreditOverLimit?: boolean;
};

export type CreateTransactionCommand = TransactionValues;

export type UpdateTransactionCommand = TransactionValues & {
    id: string;
};

export type CreateTransferCommand = {
    sourceAccountId: string;
    destinationAccountId: string;
    amount: number;
    date: Date;
    description?: string;
    notes?: string;
};

export type TransactionAccount = {
    id: string;
    type: AccountType;
    currency: Currency;
    creditLimit: number | null;
    owedAmount: number | null;
};

export type LedgerTransaction = {
    id: string;
    accountId: string;
    categoryId: string | null;
    scheduledOccurrenceId: string | null;
    transferGroupId: string | null;
    transferDirection: TransferDirection | null;
    type: LedgerTransactionType;
    amount: number;
};

export interface TransactionRepository {
    withinTransaction<T>(work: (scope: TransactionScope) => Promise<T>): Promise<T>;
}

export interface TransactionScope {
    findAccount(
        userId: string,
        accountId: string,
        options?: { activeOnly?: boolean },
    ): Promise<TransactionAccount | undefined>;
    findCompletedTransaction(
        userId: string,
        transactionId: string,
    ): Promise<LedgerTransaction | undefined>;
    findCompletedTransfer(
        userId: string,
        transferGroupId: string,
    ): Promise<LedgerTransaction[]>;
    categoryBelongsToType(
        userId: string,
        categoryId: string,
        type: TransactionType,
    ): Promise<boolean>;
    insertCompletedTransaction(input: {
        userId: string;
        accountId: string;
        categoryId: string;
        type: TransactionType;
        amount: number;
        currency: Currency;
        merchant?: string;
        notes?: string;
        date: Date;
    }): Promise<void>;
    insertCompletedTransfer(input: {
        userId: string;
        transferGroupId: string;
        sourceAccount: TransactionAccount;
        destinationAccount: TransactionAccount;
        amount: number;
        description?: string;
        notes?: string;
        date: Date;
    }): Promise<void>;
    updateCompletedTransaction(
        userId: string,
        input: UpdateTransactionCommand & { currency: Currency },
    ): Promise<boolean>;
    cancelTransactions(userId: string, transactionIds: string[]): Promise<number>;
    cancelScheduledOccurrences(userId: string, occurrenceIds: string[]): Promise<number>;
    applyBalanceDelta(
        account: TransactionAccount,
        userId: string,
        delta: number,
    ): Promise<boolean>;
}
