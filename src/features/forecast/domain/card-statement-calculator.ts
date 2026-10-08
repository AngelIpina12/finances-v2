import { subMonths } from "date-fns";
import {
    getLatestCycleClose, getPaymentDueAt, isAppCalendarDateBefore
} from "./credit-card-cycle";

export interface CardStatementTransaction {
    id?: string;
    name?: string | null;
    accountId: string;
    type: string;
    transferDirection?: "in" | "out" | null;
    financingPlanId: string | null;
    amount: number;
    date: Date;
}

export interface CardStatementInstallment {
    id?: string;
    name?: string;
    accountId: string;
    source: string;
    status: string;
    scheduledAt: Date;
    amount: number;
}

export interface CardStatementItem {
    id: string;
    name: string;
    amount: number;
    date: Date;
    kind: "purchase" | "credit" | "installment" | "payment";
}

export interface CardStatementResult {
    closesAt: Date;
    cycleStartsAt: Date;
    dueAt: Date;
    calculatedStatementBalance: number | null;
    items: CardStatementItem[];
}

export function calculateCardStatement(params: {
    cardId: string;
    billingDate: number;
    paymentTermDays: number;
    now: Date;
    transactions: CardStatementTransaction[];
    installmentOccurrences: CardStatementInstallment[];
}): CardStatementResult {
    const {
        cardId, billingDate, paymentTermDays,
        now, transactions, installmentOccurrences
    } = params;

    const closesAt = getLatestCycleClose(now, billingDate);
    const cycleStartsAt = subMonths(closesAt, 1);
    const dueAt = getPaymentDueAt(closesAt, paymentTermDays);
    const inCycle = (date: Date) => (
        isAppCalendarDateBefore(cycleStartsAt, date)
        && !isAppCalendarDateBefore(closesAt, date)
    );

    const purchaseTransactions = transactions.filter((transaction) => (
        transaction.accountId === cardId
        && transaction.type === "expense"
        && transaction.financingPlanId === null
        && inCycle(transaction.date)
    ));
    const grossPurchases = purchaseTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    const creditTransactions = transactions.filter((transaction) => (
        transaction.accountId === cardId
        && transaction.type === "income"
        && inCycle(transaction.date)
    ));
    const cycleCredits = creditTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const purchases = Math.max(0, grossPurchases - cycleCredits);

    const installmentItems = installmentOccurrences.filter((occurrence) => (
        occurrence.accountId === cardId
        && occurrence.source === "financing_installment"
        && occurrence.status === "scheduled"
        && occurrence.scheduledAt <= dueAt
    ));
    const installments = installmentItems.reduce((sum, occurrence) => sum + occurrence.amount, 0);

    const paymentTransactions = transactions.filter((transaction) => (
        transaction.accountId === cardId
        && transaction.type === "transfer"
        && transaction.transferDirection === "in"
        && isAppCalendarDateBefore(closesAt, transaction.date)
        && !isAppCalendarDateBefore(now, transaction.date)
    ));
    const payments = paymentTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);

    const calculatedStatementBalance = purchases > 0 || installments > 0 || payments > 0
        ? Math.max(0, Math.round((purchases + installments - payments) * 100) / 100)
        : null;

    const toItem = (kind: CardStatementItem["kind"], fallbackName: string) => (
        item: { id?: string; name?: string | null; amount: number },
        index: number,
        date: Date,
    ): CardStatementItem => ({
        id: item.id ?? `${kind}:${index}`,
        name: item.name || fallbackName,
        amount: item.amount,
        date,
        kind,
    });
    const purchaseItem = toItem("purchase", "Compra registrada");
    const creditItem = toItem("credit", "Abono o devolución");
    const installmentItem = toItem("installment", "Cuota de financiamiento");
    const paymentItem = toItem("payment", "Pago a la tarjeta");

    return {
        closesAt,
        cycleStartsAt,
        dueAt,
        calculatedStatementBalance,
        items: [
            ...purchaseTransactions.map((transaction, index) => purchaseItem(transaction, index, transaction.date)),
            ...creditTransactions.map((transaction, index) => creditItem(transaction, index, transaction.date)),
            ...installmentItems.map((occurrence, index) => installmentItem(occurrence, index, occurrence.scheduledAt)),
            ...paymentTransactions.map((transaction, index) => paymentItem(transaction, index, transaction.date)),
        ],
    };
}
