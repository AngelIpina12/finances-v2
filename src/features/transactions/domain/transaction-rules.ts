import type {
    LedgerTransactionType, TransactionAccount, TransactionType,
    TransferDirection,
} from "./transaction-repository";

export function getBalanceDelta(
    account: TransactionAccount,
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

export function requiresCreditOverLimitApproval(
    account: Pick<TransactionAccount, "type" | "creditLimit" | "owedAmount">,
    debtDelta: number,
) {
    return (getCreditLimitImpact(account, debtDelta)?.newlyOverLimit ?? 0) > 0;
}
