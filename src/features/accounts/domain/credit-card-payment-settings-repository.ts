import type { Currency } from "@/src/features/transactions/domain/transaction-repository";

export type CreditCardPaymentStrategy =
    | "full_statement"
    | "minimum_payment"
    | "fixed_amount"
    | "manual";

export type CreditCardPaymentSettingsInput = {
    creditAccountId: string;
    sourceAccountId: string;
    strategy: CreditCardPaymentStrategy;
    fixedAmount?: number;
    paymentTermDays: number;
    includeInForecast: boolean;
    billingDate: number;
    statementBalance?: number;
    minimumPayment?: number;
};

export type PaymentSettingsAccount = {
    id: string;
    type: "cash" | "debit" | "credit" | "wallet" | "investment" | "fixed_income" | "loan";
    currency: Currency;
    includeInLiquidity: boolean;
};

export interface CreditCardPaymentSettingsRepository {
    withinTransaction<T>(
        work: (scope: CreditCardPaymentSettingsScope) => Promise<T>,
    ): Promise<T>;
}

export interface CreditCardPaymentSettingsScope {
    findAccount(userId: string, accountId: string): Promise<PaymentSettingsAccount | undefined>;
    save(
        userId: string,
        input: CreditCardPaymentSettingsInput,
    ): Promise<void>;
}
