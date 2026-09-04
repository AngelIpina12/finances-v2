import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
    financialAccounts, financingInstallments, financingPlans,
    scheduledOccurrences, transactions,
} from "@/src/db/schema";
import { applyAccountBalanceDelta, type DatabaseTransaction } from "@/src/features/transactions/infrastructure/apply-account-balance-delta";
import type { TransactionAccount } from "@/src/features/transactions/domain/transaction-repository";
import type {
    FinancingInstallment, FinancingPlan, FinancingRepository,
    FinancingScope,
} from "../domain/financing-repository";

function toPlan(plan: typeof financingPlans.$inferSelect): FinancingPlan {
    return {
        id: plan.id,
        userId: plan.userId,
        creditAccountId: plan.creditAccountId,
        purchaseTransactionId: plan.purchaseTransactionId,
        name: plan.name,
        totalAmount: Number(plan.totalAmount),
        regularInstallmentCount: plan.regularInstallmentCount,
        regularInstallmentAmount: Number(plan.regularInstallmentAmount),
        balloonAmount: Number(plan.balloonAmount),
        currency: plan.currency as FinancingPlan["currency"],
        startsAt: plan.startsAt,
        status: plan.status as FinancingPlan["status"],
    };
}

class DrizzleFinancingScope implements FinancingScope {
    constructor(private readonly tx: DatabaseTransaction) { }

    async findEligiblePurchaseForUpdate(userId: string, transactionId: string) {
        const [purchase] = await this.tx
            .select({
                id: transactions.id,
                accountId: transactions.accountId,
                categoryId: transactions.categoryId,
                amount: transactions.amount,
                currency: transactions.currency,
                merchant: transactions.merchant,
                date: transactions.date,
            })
            .from(transactions)
            .innerJoin(financialAccounts, eq(transactions.accountId, financialAccounts.id))
            .where(and(
                eq(transactions.id, transactionId),
                eq(transactions.userId, userId),
                eq(transactions.type, "expense"),
                eq(transactions.status, "completed"),
                eq(financialAccounts.type, "credit"),
                isNull(transactions.financingPlanId),
            ))
            .limit(1)
            .for("update");

        return purchase
            ? { ...purchase, amount: Number(purchase.amount), currency: purchase.currency as "MXN" | "USD" | "EUR" | "GBP" }
            : undefined;
    }

    async createPlan(input: Parameters<FinancingScope["createPlan"]>[0]) {
        const [plan] = await this.tx
            .insert(financingPlans)
            .values({
                ...input,
                totalAmount: String(input.totalAmount),
                regularInstallmentAmount: String(input.regularInstallmentAmount),
                balloonAmount: String(input.balloonAmount),
            })
            .returning();

        return toPlan(plan);
    }

    async linkPurchaseToPlan(userId: string, purchaseTransactionId: string, planId: string) {
        const [updated] = await this.tx
            .update(transactions)
            .set({ financingPlanId: planId })
            .where(and(
                eq(transactions.id, purchaseTransactionId),
                eq(transactions.userId, userId),
                isNull(transactions.financingPlanId),
            ))
            .returning({ id: transactions.id });

        return Boolean(updated);
    }

    async createInstallments(input: Parameters<FinancingScope["createInstallments"]>[0]) {
        const created = await this.tx
            .insert(financingInstallments)
            .values(input.installments.map((installment) => ({
                financingPlanId: input.plan.id,
                sequence: installment.sequence,
                scheduledAt: installment.scheduledAt,
                amount: String(installment.amount),
                isBalloon: installment.isBalloon,
            })))
            .returning({
                id: financingInstallments.id,
                sequence: financingInstallments.sequence,
                scheduledAt: financingInstallments.scheduledAt,
                amount: financingInstallments.amount,
            });

        await this.tx.insert(scheduledOccurrences).values(created.map((installment) => ({
            userId: input.plan.userId,
            source: "financing_installment" as const,
            financingInstallmentId: installment.id,
            sequence: installment.sequence,
            accountId: input.plan.creditAccountId,
            categoryId: input.purchase.categoryId,
            transactionType: "expense" as const,
            name: `${input.plan.name} · cuota ${installment.sequence}`,
            amount: installment.amount,
            currency: input.plan.currency,
            notes: "Pago de financiamiento. Al completarlo se registrará una transferencia hacia la tarjeta.",
            originalScheduledAt: installment.scheduledAt,
            scheduledAt: installment.scheduledAt,
        })));
    }

    async findInstallmentForUpdate(userId: string, installmentId: string) {
        const [installment] = await this.tx
            .select({
                id: financingInstallments.id,
                financingPlanId: financingInstallments.financingPlanId,
                sequence: financingInstallments.sequence,
                scheduledAt: financingInstallments.scheduledAt,
                amount: financingInstallments.amount,
                isBalloon: financingInstallments.isBalloon,
                paidAt: financingInstallments.paidAt,
                creditAccountId: financingPlans.creditAccountId,
                currency: financingPlans.currency,
                planName: financingPlans.name,
                planStatus: financingPlans.status,
                scheduledOccurrenceId: scheduledOccurrences.id,
            })
            .from(financingInstallments)
            .innerJoin(financingPlans, eq(financingInstallments.financingPlanId, financingPlans.id))
            .innerJoin(
                scheduledOccurrences,
                eq(scheduledOccurrences.financingInstallmentId, financingInstallments.id),
            )
            .where(and(
                eq(financingInstallments.id, installmentId),
                eq(financingPlans.userId, userId),
                eq(scheduledOccurrences.status, "scheduled"),
            ))
            .limit(1)
            .for("update");

        return installment
            ? {
                ...installment,
                amount: Number(installment.amount),
                currency: installment.currency as FinancingInstallment["currency"],
                planStatus: installment.planStatus as FinancingInstallment["planStatus"],
            }
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
            } as TransactionAccount
            : undefined;
    }

    async insertPaymentTransfer(input: Parameters<FinancingScope["insertPaymentTransfer"]>[0]) {
        const common = {
            userId: input.userId,
            transferGroupId: input.transferGroupId,
            financingPlanId: input.installment.financingPlanId,
            financingInstallmentId: input.installment.id,
            type: "transfer" as const,
            status: "completed" as const,
            amount: String(input.installment.amount),
            merchant: `Pago de ${input.installment.planName}`,
            notes: `Cuota ${input.installment.sequence}${input.installment.isBalloon ? " · pago final" : ""}`,
            date: input.paidAt,
        };

        await this.tx.insert(transactions).values([
            {
                ...common,
                accountId: input.sourceAccount.id,
                transferDirection: "out",
                currency: input.sourceAccount.currency,
                scheduledOccurrenceId: input.installment.scheduledOccurrenceId,
            },
            {
                ...common,
                accountId: input.creditAccount.id,
                transferDirection: "in",
                currency: input.creditAccount.currency,
            },
        ]);
    }

    async applyBalanceDelta(account: TransactionAccount, userId: string, delta: number) {
        return applyAccountBalanceDelta(this.tx, account, userId, delta);
    }

    async markInstallmentPaid(userId: string, installmentId: string, paidAt: Date, transferGroupId: string) {
        const [updated] = await this.tx
            .update(financingInstallments)
            .set({ paidAt, paymentTransferGroupId: transferGroupId })
            .where(and(
                eq(financingInstallments.id, installmentId),
                isNull(financingInstallments.paidAt),
                sql`${financingInstallments.financingPlanId} in (
                    select ${financingPlans.id} from ${financingPlans}
                    where ${financingPlans.userId} = ${userId}
                )`,
            ))
            .returning({ id: financingInstallments.id });

        return Boolean(updated);
    }

    async completeScheduledOccurrence(userId: string, occurrenceId: string, paidAt: Date) {
        const [updated] = await this.tx
            .update(scheduledOccurrences)
            .set({ status: "completed", executedAt: paidAt })
            .where(and(
                eq(scheduledOccurrences.id, occurrenceId),
                eq(scheduledOccurrences.userId, userId),
                eq(scheduledOccurrences.status, "scheduled"),
            ))
            .returning({ id: scheduledOccurrences.id });

        return Boolean(updated);
    }

    async completePlanIfPaid(userId: string, planId: string) {
        const [pending] = await this.tx
            .select({ id: financingInstallments.id })
            .from(financingInstallments)
            .where(and(
                eq(financingInstallments.financingPlanId, planId),
                isNull(financingInstallments.paidAt),
            ))
            .limit(1);

        if (pending) return;

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

export class DrizzleFinancingRepository implements FinancingRepository {
    async withinTransaction<T>(work: (scope: FinancingScope) => Promise<T>) {
        return db.transaction((tx) => work(new DrizzleFinancingScope(tx)));
    }
}
