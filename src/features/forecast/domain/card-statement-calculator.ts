import { subMonths } from "date-fns";
import {
    getLatestCycleClose, getPaymentDueAt, isAppCalendarDateBefore
} from "./credit-card-cycle";

export interface CardStatementTransaction {
    accountId: string;
    type: string;
    transferDirection?: "in" | "out" | null;
    financingPlanId: string | null;
    amount: number;
    date: Date;
}

export interface CardStatementInstallment {
    accountId: string;
    source: string;
    status: string;
    scheduledAt: Date;
    amount: number;
}

export interface CardStatementResult {
    closesAt: Date;
    cycleStartsAt: Date;
    dueAt: Date;
    calculatedStatementBalance: number | null;
}

export function calculateCardStatement(params: {
    cardId: string;
    billingDate: number;
    paymentTermDays: number;
    now: Date;
    transactions: CardStatementTransaction[];
    installmentOccurrences: CardStatementInstallment[];
}): CardStatementResult {
    const { cardId, billingDate, paymentTermDays, now, transactions, installmentOccurrences } = params;

    const closesAt = getLatestCycleClose(now, billingDate);
    const cycleStartsAt = subMonths(closesAt, 1);
    const dueAt = getPaymentDueAt(closesAt, paymentTermDays);
    const inCycle = (date: Date) => (
        isAppCalendarDateBefore(cycleStartsAt, date)
        && !isAppCalendarDateBefore(closesAt, date)
    );

    const grossPurchases = transactions
        .filter((transaction) => (
            transaction.accountId === cardId
            && transaction.type === "expense"
            && transaction.financingPlanId === null
            && inCycle(transaction.date)
        ))
        .reduce((sum, transaction) => sum + transaction.amount, 0);

    const cycleCredits = transactions
        .filter((transaction) => (
            transaction.accountId === cardId
            && transaction.type === "income"
            && inCycle(transaction.date)
        ))
        .reduce((sum, transaction) => sum + transaction.amount, 0);
    const purchases = Math.max(0, grossPurchases - cycleCredits);

    const installments = installmentOccurrences
        .filter((occurrence) => (
            occurrence.accountId === cardId
            && occurrence.source === "financing_installment"
            && occurrence.status === "scheduled"
            && occurrence.scheduledAt <= dueAt
        ))
        .reduce((sum, occurrence) => sum + occurrence.amount, 0);

    const payments = transactions
        .filter((transaction) => (
            transaction.accountId === cardId
            && transaction.type === "transfer"
            && transaction.transferDirection === "in"
            && isAppCalendarDateBefore(closesAt, transaction.date)
            && !isAppCalendarDateBefore(now, transaction.date)
        ))
        .reduce((sum, transaction) => sum + transaction.amount, 0);

    const calculatedStatementBalance = purchases > 0 || installments > 0 || payments > 0
        ? Math.max(0, Math.round((purchases + installments - payments) * 100) / 100)
        : null;

    return { closesAt, cycleStartsAt, dueAt, calculatedStatementBalance };
}
