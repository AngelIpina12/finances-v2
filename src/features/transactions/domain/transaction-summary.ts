import type { TransactionListItem } from "../queries/get-transaction-data";

type SummaryTransaction = Pick<
    TransactionListItem,
    "accountId" | "accountName" | "amount" | "currency" | "status" | "type" | "transferDirection" | "financingPlanId"
>;

export type AccountTransactionTotal = {
    accountId: string;
    accountName: string;
    currency: string;
    total: number;
};

export function getTransactionImpact(transaction: SummaryTransaction) {
    if (transaction.status === "cancelled") return 0;
    // La compra ya se distribuye en cuotas; sólo éstas representan el flujo
    // que se debe pagar, no el cargo completo al crear el financiamiento.
    if (transaction.type === "expense" && transaction.financingPlanId) return 0;

    const amount = Number(transaction.amount);
    if (transaction.type === "income") return amount;
    if (transaction.type === "expense") return -amount;
    return transaction.transferDirection === "in" ? amount : -amount;
}

export function summarizeTransactionsByAccount(transactions: SummaryTransaction[]) {
    const totals = new Map<string, AccountTransactionTotal>();

    for (const transaction of transactions) {
        const current = totals.get(transaction.accountId) ?? {
            accountId: transaction.accountId,
            accountName: transaction.accountName,
            currency: transaction.currency,
            total: 0,
        };
        current.total += getTransactionImpact(transaction);
        totals.set(transaction.accountId, current);
    }

    return [...totals.values()];
}

export function summarizeTransactionsByCurrency(totals: AccountTransactionTotal[]) {
    return totals.reduce<Record<string, number>>((result, account) => {
        result[account.currency] = (result[account.currency] ?? 0) + account.total;
        return result;
    }, {});
}
