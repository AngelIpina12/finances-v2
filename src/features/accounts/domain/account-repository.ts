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
    currentBalance?: number;
    color: string;
    lastFourDigits?: string;
    includeInNetWorth: boolean;
    includeInLiquidity: boolean;
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
    includeInLiquidity: boolean;
    creditLimit: string | null;
    owedAmount: string | null;
    availableCredit: string | null;
    billingDate: number | null;
    dueDate: number | null;
};

// Los saldos se modifican desde el ledger. La edición de los datos de una
// cuenta no debe reconstruirlos a partir del saldo con el que se creó.
export type AccountUpdateRecord = Omit<
    AccountRecord,
    "openingBalance" | "owedAmount" | "availableCredit"
>;

export interface AccountRepository {
    create(userId: string, account: AccountRecord): Promise<void>;
    update(userId: string, accountId: string, account: AccountUpdateRecord): Promise<boolean>;
    archive(userId: string, accountId: string): Promise<boolean>;
}
