import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import {
    creditCardPaymentSettings, financialAccounts, financingInstallments,
    financingPlans, scheduledOccurrences, transactions,
} from "@/src/db/schema";
import type { DatabaseTransaction } from "@/src/features/transactions/infrastructure/apply-account-balance-delta";
import { applyAccountBalanceDelta } from "@/src/features/transactions/infrastructure/apply-account-balance-delta";
import type { TransactionAccount } from "@/src/features/transactions/domain/transaction-repository";
import { isAppCalendarDateBefore } from "../domain/credit-card-cycle";
import type {
    CardStatementCard, CardStatementRepository, CardStatementScope, UnpaidInstallment,
} from "../domain/card-statement-repository";

class DrizzleCardStatementScope implements CardStatementScope {
    constructor(private readonly tx: DatabaseTransaction) { }

    async findCard(userId: string, creditAccountId: string): Promise<CardStatementCard | undefined> {
        const [card] = await this.tx
            .select({
                id: financialAccounts.id,
                name: financialAccounts.name,
                currency: financialAccounts.currency,
                billingDate: financialAccounts.billingDate,
            })
            .from(financialAccounts)
            .where(and(
                eq(financialAccounts.id, creditAccountId),
                eq(financialAccounts.userId, userId),
                eq(financialAccounts.type, "credit"),
                eq(financialAccounts.isActive, true),
                isNull(financialAccounts.deletedAt),
            ))
            .limit(1);

        return card && card.billingDate !== null
            ? { ...card, currency: card.currency as CardStatementCard["currency"], billingDate: card.billingDate }
            : undefined;
    }

    async findAccount(userId: string, accountId: string, options: { activeOnly?: boolean } = {}) {
        const conditions = [
            eq(financialAccounts.id, accountId),
            eq(financialAccounts.userId, userId),
            isNull(financialAccounts.deletedAt),
        ];

        if (options.activeOnly) conditions.push(eq(financialAccounts.isActive, true));

        const [account] = await this.tx
            .select({
                id: financialAccounts.id,
                type: financialAccounts.type,
                currency: financialAccounts.currency,
                creditLimit: financialAccounts.creditLimit,
                owedAmount: financialAccounts.owedAmount,
                currentBalance: financialAccounts.currentBalance,
            })
            .from(financialAccounts)
            .where(and(...conditions))
            .limit(1)
            .for("update");

        return account
            ? {
                ...account,
                creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
                owedAmount: account.owedAmount === null ? null : Number(account.owedAmount),
                currentBalance: Number(account.currentBalance),
            } as TransactionAccount
            : undefined;
    }

    async getPaymentTermDays(userId: string, creditAccountId: string) {
        const [setting] = await this.tx
            .select({ paymentTermDays: creditCardPaymentSettings.paymentTermDays })
            .from(creditCardPaymentSettings)
            .where(and(
                eq(creditCardPaymentSettings.userId, userId),
                eq(creditCardPaymentSettings.creditAccountId, creditAccountId),
            ))
            .limit(1);

        return setting?.paymentTermDays;
    }

    private async findCompletedTransactions(userId: string, accountId: string) {
        return this.tx
            .select({
                type: transactions.type,
                transferDirection: transactions.transferDirection,
                financingPlanId: transactions.financingPlanId,
                amount: transactions.amount,
                date: transactions.date,
            })
            .from(transactions)
            .where(and(
                eq(transactions.userId, userId),
                eq(transactions.accountId, accountId),
                eq(transactions.status, "completed"),
            ));
    }

    async sumRegularCharges(userId: string, creditAccountId: string, cycleStartsAt: Date, closesAt: Date) {
        const rows = await this.findCompletedTransactions(userId, creditAccountId);
        return rows
            .filter((row) => (
                row.type === "expense"
                && row.financingPlanId === null
                && isAppCalendarDateBefore(cycleStartsAt, row.date)
                && !isAppCalendarDateBefore(closesAt, row.date)
            ))
            .reduce((sum, row) => sum + Number(row.amount), 0);
    }

    async sumCycleCredits(userId: string, creditAccountId: string, cycleStartsAt: Date, closesAt: Date) {
        const rows = await this.findCompletedTransactions(userId, creditAccountId);
        return rows
            .filter((row) => (
                row.type === "income"
                && isAppCalendarDateBefore(cycleStartsAt, row.date)
                && !isAppCalendarDateBefore(closesAt, row.date)
            ))
            .reduce((sum, row) => sum + Number(row.amount), 0);
    }

    async sumPaymentsSinceClose(userId: string, creditAccountId: string, closesAt: Date, now: Date) {
        const rows = await this.findCompletedTransactions(userId, creditAccountId);
        return rows
            .filter((row) => (
                row.type === "transfer"
                && row.transferDirection === "in"
                && isAppCalendarDateBefore(closesAt, row.date)
                && !isAppCalendarDateBefore(now, row.date)
            ))
            .reduce((sum, row) => sum + Number(row.amount), 0);
    }

    async findUnpaidInstallmentsDue(userId: string, creditAccountId: string, dueAt: Date): Promise<UnpaidInstallment[]> {
        const rows = await this.tx
            .select({
                id: financingInstallments.id,
                financingPlanId: financingInstallments.financingPlanId,
                amount: financingInstallments.amount,
                scheduledAt: financingInstallments.scheduledAt,
                scheduledOccurrenceId: scheduledOccurrences.id,
            })
            .from(financingInstallments)
            .innerJoin(financingPlans, eq(financingInstallments.financingPlanId, financingPlans.id))
            .innerJoin(
                scheduledOccurrences,
                eq(scheduledOccurrences.financingInstallmentId, financingInstallments.id),
            )
            .where(and(
                eq(financingPlans.userId, userId),
                eq(financingPlans.creditAccountId, creditAccountId),
                eq(financingPlans.status, "active"),
                isNull(financingInstallments.paidAt),
                eq(scheduledOccurrences.status, "scheduled"),
            ))
            .for("update");

        return rows
            .filter((row) => row.scheduledAt <= dueAt)
            .map((row) => ({
                id: row.id,
                financingPlanId: row.financingPlanId,
                scheduledOccurrenceId: row.scheduledOccurrenceId,
                amount: Number(row.amount),
            }));
    }

    async insertStatementPayment(input: Parameters<CardStatementScope["insertStatementPayment"]>[0]) {
        const common = {
            userId: input.userId,
            transferGroupId: input.transferGroupId,
            type: "transfer" as const,
            status: "completed" as const,
            amount: String(input.amount),
            merchant: `Pago de estado de cuenta · ${input.card.name}`,
            notes: "Pago combinado: cargos regulares y cuotas MSI del ciclo.",
            date: input.paidAt,
        };

        await this.tx.insert(transactions).values([
            {
                ...common,
                accountId: input.sourceAccount.id,
                transferDirection: "out",
                currency: input.sourceAccount.currency,
            },
            {
                ...common,
                accountId: input.card.id,
                transferDirection: "in",
                currency: input.card.currency,
            },
        ]);
    }

    async applyBalanceDelta(account: TransactionAccount, userId: string, delta: number) {
        return applyAccountBalanceDelta(this.tx, account, userId, delta);
    }

    async markInstallmentsPaid(userId: string, installmentIds: string[], paidAt: Date, transferGroupId: string) {
        if (!installmentIds.length) return 0;

        const updated = await this.tx
            .update(financingInstallments)
            .set({ paidAt, paymentTransferGroupId: transferGroupId })
            .where(and(
                inArray(financingInstallments.id, installmentIds),
                isNull(financingInstallments.paidAt),
                inArray(
                    financingInstallments.financingPlanId,
                    this.tx.select({ id: financingPlans.id }).from(financingPlans).where(eq(financingPlans.userId, userId)),
                ),
            ))
            .returning({ id: financingInstallments.id });

        return updated.length;
    }

    async completeScheduledOccurrences(userId: string, occurrenceIds: string[], paidAt: Date) {
        if (!occurrenceIds.length) return 0;

        const updated = await this.tx
            .update(scheduledOccurrences)
            .set({ status: "completed", executedAt: paidAt })
            .where(and(
                inArray(scheduledOccurrences.id, occurrenceIds),
                eq(scheduledOccurrences.userId, userId),
                eq(scheduledOccurrences.status, "scheduled"),
            ))
            .returning({ id: scheduledOccurrences.id });

        return updated.length;
    }

    async completePlansIfPaid(userId: string, planIds: string[]) {
        for (const planId of planIds) {
            const [pending] = await this.tx
                .select({ id: financingInstallments.id })
                .from(financingInstallments)
                .where(and(
                    eq(financingInstallments.financingPlanId, planId),
                    isNull(financingInstallments.paidAt),
                ))
                .limit(1);

            if (pending) continue;

            await this.tx
                .update(financingPlans)
                .set({ status: "completed" })
                .where(and(
                    eq(financingPlans.id, planId),
                    eq(financingPlans.userId, userId),
                    eq(financingPlans.status, "active"),
                ));
        }
    }
}

export class DrizzleCardStatementRepository implements CardStatementRepository {
    async withinTransaction<T>(work: (scope: CardStatementScope) => Promise<T>) {
        return db.transaction((tx) => work(new DrizzleCardStatementScope(tx)));
    }
}
