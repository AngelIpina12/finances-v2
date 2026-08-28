import type { financialAccounts } from "@/src/db/schema";
import type { FinancialAccountInput } from "../schemas/financial-account.schema";

type FinancialAccount = typeof financialAccounts.$inferSelect;

export function createFinancialAccountDraft(): FinancialAccountInput {
  return {
    name: "",
    type: "debit",
    currency: "MXN",
    institution: "",
    openingBalance: 0,
    color: "#2563eb",
    lastFourDigits: "",
    includeInNetWorth: true,
    creditLimit: undefined,
    owedAmount: undefined,
    availableCredit: undefined,
    billingDate: undefined,
    dueDate: undefined,
  };
}

export function toFinancialAccountDraft(
  account: FinancialAccount,
): FinancialAccountInput {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    currency: account.currency,
    institution: account.institution ?? "",
    openingBalance: Number(account.openingBalance),
    color: account.color || "#2563eb",
    lastFourDigits: account.lastFourDigits ?? "",
    includeInNetWorth: account.includeInNetWorth,
    creditLimit: account.creditLimit ? Number(account.creditLimit) : undefined,
    owedAmount:
      account.type === "credit"
        ? Number(account.owedAmount ?? account.currentBalance)
        : undefined,
    availableCredit: account.availableCredit
      ? Number(account.availableCredit)
      : undefined,
    billingDate: account.billingDate ?? undefined,
    dueDate: account.dueDate ?? undefined,
  };
}
