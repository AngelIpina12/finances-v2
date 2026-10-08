import type {
    AccountType, LedgerTransactionType, TransactionAccount,
    TransactionType, TransferDirection,
} from "./transaction-repository";

export function getBalanceDelta(
    account: Pick<TransactionAccount, "type">,
    type: LedgerTransactionType,
    amount: number,
    transferDirection?: TransferDirection | null,
) {
    const increasesFunds = type === "income"
        || (type === "transfer" && transferDirection === "in");

    if (account.type === "credit") {
        return increasesFunds ? -amount : amount;
    }

    return increasesFunds ? amount : -amount;
}

export function isEditableTransactionType(
    type: LedgerTransactionType,
): type is TransactionType {
    return type === "income" || type === "expense";
}

export type CreditLimitImpact = {
    currentDebt: number;
    currentOverLimit: number;
    projectedDebt: number;
    projectedOverLimit: number;
    newlyOverLimit: number;
};

export function getCreditLimitImpact(
    account: Pick<TransactionAccount, "type" | "creditLimit" | "owedAmount">,
    debtDelta: number,
): CreditLimitImpact | null {
    if (account.type !== "credit" || account.creditLimit === null) {
        return null;
    }

    const currentDebt = account.owedAmount ?? 0;
    const currentOverLimit = Math.max(0, currentDebt - account.creditLimit);
    const projectedDebt = currentDebt + debtDelta;
    const projectedOverLimit = Math.max(0, projectedDebt - account.creditLimit);

    return {
        currentDebt,
        currentOverLimit,
        projectedDebt,
        projectedOverLimit,
        newlyOverLimit: Math.max(0, projectedOverLimit - currentOverLimit),
    };
}

const BALANCE_GUARDED_ACCOUNT_TYPES: ReadonlySet<AccountType> = new Set([
    "cash", "debit", "wallet", "investment", "fixed_income",
]);

export type NegativeBalanceImpact = {
    currentBalance: number;
    projectedBalance: number;
    projectedShortfall: number;
    newShortfall: number;
};

function roundCents(value: number) {
    return Math.round(value * 100) / 100;
}

export function getNegativeBalanceImpact(
    account: Pick<TransactionAccount, "type" | "currentBalance">,
    balanceDelta: number,
): NegativeBalanceImpact | null {
    if (!BALANCE_GUARDED_ACCOUNT_TYPES.has(account.type)) {
        return null;
    }

    const currentBalance = account.currentBalance;
    const projectedBalance = roundCents(currentBalance + balanceDelta);
    const currentShortfall = Math.max(0, -currentBalance);
    const projectedShortfall = Math.max(0, -projectedBalance);

    return {
        currentBalance,
        projectedBalance,
        projectedShortfall,
        newShortfall: roundCents(Math.max(0, projectedShortfall - currentShortfall)),
    };
}

export type FundsImpact =
    | { kind: "credit_limit"; projectedShortfall: number; newShortfall: number }
    | { kind: "negative_balance"; projectedShortfall: number; newShortfall: number };

export type FundsAccount = Pick<
    TransactionAccount,
    "type" | "creditLimit" | "owedAmount" | "currentBalance"
>;

export function getFundsImpact(account: FundsAccount, balanceDelta: number): FundsImpact | null {
    if (account.type === "credit") {
        const impact = getCreditLimitImpact(account, balanceDelta);

        return impact && {
            kind: "credit_limit",
            projectedShortfall: impact.projectedOverLimit,
            newShortfall: impact.newlyOverLimit,
        };
    }

    const impact = getNegativeBalanceImpact(account, balanceDelta);

    return impact && {
        kind: "negative_balance",
        projectedShortfall: impact.projectedShortfall,
        newShortfall: impact.newShortfall,
    };
}

export function requiresFundsApproval(account: FundsAccount, balanceDelta: number) {
    return (getFundsImpact(account, balanceDelta)?.newShortfall ?? 0) > 0;
}

export class InsufficientFundsError extends Error {
    readonly kind: FundsImpact["kind"];

    constructor(account: Pick<TransactionAccount, "type">, action = "registrarlo") {
        super(
            account.type === "credit"
                ? `El movimiento excede el límite de crédito. Confirma que deseas ${action} de todos modos.`
                : `El movimiento dejaría la cuenta con saldo negativo. Confirma que deseas ${action} de todos modos.`,
        );
        this.name = "InsufficientFundsError";
        this.kind = account.type === "credit" ? "credit_limit" : "negative_balance";
    }
}

export function assertFundsApproved(
    account: FundsAccount,
    balanceDelta: number,
    approved: boolean | undefined,
    action?: string,
) {
    if (!approved && requiresFundsApproval(account, balanceDelta)) {
        throw new InsufficientFundsError(account, action);
    }
}
