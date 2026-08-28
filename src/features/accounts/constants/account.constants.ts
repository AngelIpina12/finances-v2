import type { FinancialAccountInput } from "../schemas/financial-account.schema";

export const ACCOUNT_TYPE_LABELS: Record<
    FinancialAccountInput["type"],
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
