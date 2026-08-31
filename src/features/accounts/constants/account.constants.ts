import type { FinancialAccountFormData } from "../schemas/financial-account.schema";

export const ACCOUNT_TYPE_LABELS: Record<
    FinancialAccountFormData["type"],
    string
> = {
    cash: "Efectivo",
    debit: "Débito",
    credit: "Crédito",
    wallet: "Wallet",
    investment: "Inversión",
    fixed_income: "Renta fija",
    loan: "Préstamo",
};
