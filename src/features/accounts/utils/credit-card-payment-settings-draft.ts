import type { CreditCardPaymentSettingsFormData } from "../schemas/credit-card-payment-settings.schema";

export function createCreditCardPaymentSettingsDraft(input: {
    creditAccountId: string;
    billingDate: number | null;
    statementBalance: number | null;
    minimumPayment: number | null;
    setting?: {
        sourceAccountId: string;
        strategy: "full_statement" | "minimum_payment" | "fixed_amount" | "manual";
        fixedAmount: number | null;
        paymentTermDays: number;
        includeInForecast: boolean;
    } | null;
}): CreditCardPaymentSettingsFormData {
    return {
        creditAccountId: input.creditAccountId,
        sourceAccountId: input.setting?.sourceAccountId ?? "",
        strategy: input.setting?.strategy ?? "full_statement",
        fixedAmount: input.setting?.fixedAmount ?? undefined,
        paymentTermDays: input.setting?.paymentTermDays ?? 20,
        includeInForecast: input.setting?.includeInForecast ?? true,
        billingDate: input.billingDate ?? 1,
        statementBalance: input.statementBalance ?? undefined,
        minimumPayment: input.minimumPayment ?? undefined,
    };
}
