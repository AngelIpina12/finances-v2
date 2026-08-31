export type AccountType =
    | "cash"
    | "debit"
    | "credit"
    | "wallet"
    | "investment"
    | "fixed_income"
    | "loan";

export type Currency = "MXN" | "USD" | "EUR" | "GBP";

export type AccountInput = {
    type: AccountType;
    currency: Currency;
    name: string;
    institution?: string;
    openingBalance: number;
    color: string;
    lastFourDigits?: string;
    includeInNetWorth: boolean;
    creditLimit?: number;
    owedAmount?: number;
    billingDate?: number;
    dueDate?: number;
};

export type AccountRecord = {
    name: string;
    type: AccountType;
    currency: Currency;
    institution: string | null;
    openingBalance: string;
    currentBalance: string;
    color: string;
    lastFourDigits: string | null;
    includeInNetWorth: boolean;
    creditLimit: string | null;
    owedAmount: string | null;
    availableCredit: string | null;
    billingDate: number | null;
    dueDate: number | null;
};

export interface AccountRepository {
    create(userId: string, account: AccountRecord): Promise<void>;
    update(userId: string, accountId: string, account: AccountRecord): Promise<boolean>;
    archive(userId: string, accountId: string): Promise<boolean>;
}
