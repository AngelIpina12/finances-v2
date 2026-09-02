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
