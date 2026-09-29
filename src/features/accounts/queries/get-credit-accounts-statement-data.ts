import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/src/db";
import {
    creditCardPaymentSettings, financialAccounts, scheduledOccurrences, transactions,
} from "@/src/db/schema";
import { occurrenceHasLiveRule } from "@/src/features/scheduled/infrastructure/live-rule-occurrence";
import { calculateCardStatement } from "@/src/features/forecast/domain/card-statement-calculator";

export interface CreditAccountStatement {
    closesAt: Date;
    dueAt: Date;
    statementAmount: number;
    sourceAccountId: string | null;
    sourceAccountName: string | null;
}

export async function getCreditAccountsStatementData(
    userId: string,
    creditAccounts: { id: string; billingDate: number | null; statementBalance: string | null }[],
    now = new Date(),
): Promise<Record<string, CreditAccountStatement>> {
    const eligible = creditAccounts.filter((account) => account.billingDate !== null);

    if (!eligible.length) return {};

    const accountIds = eligible.map((account) => account.id);

    const [settings, completedTransactions, installmentOccurrences] = await Promise.all([
        db
            .select({
                creditAccountId: creditCardPaymentSettings.creditAccountId,
                sourceAccountId: creditCardPaymentSettings.sourceAccountId,
                sourceAccountName: financialAccounts.name,
                paymentTermDays: creditCardPaymentSettings.paymentTermDays,
            })
            .from(creditCardPaymentSettings)
            .innerJoin(financialAccounts, eq(financialAccounts.id, creditCardPaymentSettings.sourceAccountId))
            .where(and(
                eq(creditCardPaymentSettings.userId, userId),
                inArray(creditCardPaymentSettings.creditAccountId, accountIds),
            )),
        db
            .select({
                accountId: transactions.accountId,
                type: transactions.type,
                transferDirection: transactions.transferDirection,
                financingPlanId: transactions.financingPlanId,
                amount: transactions.amount,
                date: transactions.date,
            })
            .from(transactions)
            .where(and(
                eq(transactions.userId, userId),
                eq(transactions.status, "completed"),
                inArray(transactions.accountId, accountIds),
            )),
        db
            .select({
                accountId: scheduledOccurrences.accountId,
                source: scheduledOccurrences.source,
                status: scheduledOccurrences.status,
                scheduledAt: scheduledOccurrences.scheduledAt,
                amount: scheduledOccurrences.amount,
            })
            .from(scheduledOccurrences)
            .where(and(
                eq(scheduledOccurrences.userId, userId),
                inArray(scheduledOccurrences.accountId, accountIds),
                occurrenceHasLiveRule,
            )),
    ]);

    const result: Record<string, CreditAccountStatement> = {};

    for (const account of eligible) {
        const setting = settings.find((item) => item.creditAccountId === account.id);
        const { closesAt, dueAt, calculatedStatementBalance } = calculateCardStatement({
            cardId: account.id,
            billingDate: account.billingDate!,
            paymentTermDays: setting?.paymentTermDays ?? 0,
            now,
            transactions: completedTransactions.map((transaction) => ({
                accountId: transaction.accountId,
                type: transaction.type,
                transferDirection: transaction.transferDirection,
                financingPlanId: transaction.financingPlanId,
                amount: Number(transaction.amount),
                date: transaction.date,
            })),
            installmentOccurrences: installmentOccurrences.map((occurrence) => ({
                accountId: occurrence.accountId,
                source: occurrence.source,
                status: occurrence.status,
                scheduledAt: occurrence.scheduledAt,
                amount: Number(occurrence.amount),
            })),
        });

        result[account.id] = {
            closesAt,
            dueAt,
            statementAmount: calculatedStatementBalance ?? Number(account.statementBalance ?? 0),
            sourceAccountId: setting?.sourceAccountId ?? null,
            sourceAccountName: setting?.sourceAccountName ?? null,
        };
    }

    return result;
}
