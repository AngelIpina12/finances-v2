import type { AccountInput, AccountRecord } from "./account-repository";

export function buildAccountRecord(input: AccountInput): AccountRecord {
    const isCreditAccount = input.type === "credit";
    const owedAmount = isCreditAccount ? (input.owedAmount ?? 0) : null;
    const creditLimit = isCreditAccount ? (input.creditLimit ?? 0) : null;
    const currentBalance = isCreditAccount ? owedAmount : input.openingBalance;
    const availableCredit = isCreditAccount
        ? Math.max(0, (creditLimit ?? 0) - (owedAmount ?? 0))
        : null;

    return {
        name: input.name,
        type: input.type,
        currency: input.currency,
        institution: input.institution || null,
        openingBalance: String(isCreditAccount ? 0 : input.openingBalance),
        currentBalance: String(currentBalance),
        color: input.color,
        lastFourDigits: input.lastFourDigits || null,
        includeInNetWorth: input.includeInNetWorth,
        creditLimit: creditLimit === null ? null : String(creditLimit),
        owedAmount: owedAmount === null ? null : String(owedAmount),
        availableCredit: availableCredit === null ? null : String(availableCredit),
        billingDate: isCreditAccount ? (input.billingDate ?? null) : null,
        dueDate: isCreditAccount ? (input.dueDate ?? null) : null,
    };
}
