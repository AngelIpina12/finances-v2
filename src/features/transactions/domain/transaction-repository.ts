export type TransactionType = "income" | "expense";
export type AccountType =
    | "cash"
    | "debit"
    | "credit"
    | "wallet"
    | "investment"
    | "fixed_income"
    | "loan";
export type Currency = "MXN" | "USD" | "EUR" | "GBP";

export type CreateTransactionCommand = {
    accountId: string;
    categoryId: string;
    type: TransactionType;
    amount: number;
    date: Date;
    merchant?: string;
    notes?: string;
};

export type TransactionAccount = {
    id: string;
    type: AccountType;
    currency: Currency;
};

export interface TransactionRepository {
    withinTransaction<T>(work: (scope: TransactionScope) => Promise<T>): Promise<T>;
}

export interface TransactionScope {
    findActiveAccount(userId: string, accountId: string): Promise<TransactionAccount | undefined>;
    categoryBelongsToType(userId: string, categoryId: string, type: TransactionType): Promise<boolean>;
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
    applyBalanceDelta(account: TransactionAccount, userId: string, delta: number): Promise<boolean>;
}
