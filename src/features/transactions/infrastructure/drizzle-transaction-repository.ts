import {
    and, eq, inArray,
    isNull,
} from "drizzle-orm";
import { db } from "@/src/db";
import {
    categories, financialAccounts, scheduledOccurrences,
    financingInstallments, financingPlans, transactions,
} from "@/src/db/schema";
import type {
    LedgerTransaction, TransactionAccount, TransactionRepository,
    TransactionScope,
} from "../domain/transaction-repository";
import { applyAccountBalanceDelta, type DatabaseTransaction } from "./apply-account-balance-delta";

class DrizzleTransactionScope implements TransactionScope {
    constructor(private readonly tx: DatabaseTransaction) { }

    async findAccount(userId: string, accountId: string, options: { activeOnly?: boolean } = {}) {
        const conditions = [
            eq(financialAccounts.id, accountId),
            eq(financialAccounts.userId, userId),
            isNull(financialAccounts.deletedAt),
        ];

        if (options.activeOnly) {
            conditions.push(eq(financialAccounts.isActive, true));
        }

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
                creditLimit: account.creditLimit === null
                    ? null
                    : Number(account.creditLimit),
                owedAmount: account.owedAmount === null
                    ? null
                    : Number(account.owedAmount),
            } as TransactionAccount
            : undefined;
    }

    async findCompletedTransaction(userId: string, transactionId: string) {
        const [transaction] = await this.tx
            .select({
                id: transactions.id,
                accountId: transactions.accountId,
                categoryId: transactions.categoryId,
                scheduledOccurrenceId: transactions.scheduledOccurrenceId,
                financingPlanId: transactions.financingPlanId,
                financingInstallmentId: transactions.financingInstallmentId,
                transferGroupId: transactions.transferGroupId,
                transferDirection: transactions.transferDirection,
                type: transactions.type,
                amount: transactions.amount,
            })
            .from(transactions)
            .where(
                and(
                    eq(transactions.id, transactionId),
                    eq(transactions.userId, userId),
                    eq(transactions.status, "completed"),
                ),
            )
            .limit(1)
            .for("update");

        return transaction
            ? { ...transaction, amount: Number(transaction.amount) } as LedgerTransaction
            : undefined;
    }

    async findCompletedTransfer(userId: string, transferGroupId: string) {
        const movements = await this.tx
            .select({
                id: transactions.id,
                accountId: transactions.accountId,
                categoryId: transactions.categoryId,
                scheduledOccurrenceId: transactions.scheduledOccurrenceId,
                financingPlanId: transactions.financingPlanId,
                financingInstallmentId: transactions.financingInstallmentId,
                transferGroupId: transactions.transferGroupId,
                transferDirection: transactions.transferDirection,
                type: transactions.type,
                amount: transactions.amount,
            })
            .from(transactions)
            .where(
                and(
                    eq(transactions.userId, userId),
                    eq(transactions.transferGroupId, transferGroupId),
                    eq(transactions.status, "completed"),
                ),
            )
            .for("update");

        return movements.map((movement) => ({
            ...movement,
            amount: Number(movement.amount),
        })) as LedgerTransaction[];
    }

    async categoryBelongsToType(userId: string, categoryId: string, type: "income" | "expense") {
        const [category] = await this.tx
            .select({ id: categories.id })
            .from(categories)
            .where(
                and(
                    eq(categories.id, categoryId),
                    eq(categories.userId, userId),
                    eq(categories.type, type),
                    isNull(categories.deletedAt),
                ),
            )
            .limit(1);

        return Boolean(category);
    }

    async insertCompletedTransaction(input: Parameters<TransactionScope["insertCompletedTransaction"]>[0]) {
        await this.tx.insert(transactions).values({
            userId: input.userId,
            accountId: input.accountId,
            categoryId: input.categoryId,
            type: input.type,
            status: "completed",
            amount: String(input.amount),
            currency: input.currency,
            merchant: input.merchant || null,
            notes: input.notes || null,
            date: input.date,
        });
    }

    async insertCompletedTransfer(input: Parameters<TransactionScope["insertCompletedTransfer"]>[0]) {
        const common = {
            userId: input.userId,
            transferGroupId: input.transferGroupId,
            type: "transfer" as const,
            status: "completed" as const,
            amount: String(input.amount),
            merchant: input.description || null,
            notes: input.notes || null,
            date: input.date,
            financingPlanId: input.financingPlanId || null,
            financingInstallmentId: input.financingInstallmentId || null,
        };

        await this.tx.insert(transactions).values([
            {
                ...common,
                accountId: input.sourceAccount.id,
                transferDirection: "out",
                currency: input.sourceAccount.currency,
                scheduledOccurrenceId: input.scheduledOccurrenceId || null,
            },
            {
                ...common,
                accountId: input.destinationAccount.id,
                transferDirection: "in",
                currency: input.destinationAccount.currency,
            },
        ]);
    }

    async updateCompletedTransaction(userId: string, input: Parameters<TransactionScope["updateCompletedTransaction"]>[1]) {
        const [updated] = await this.tx
            .update(transactions)
            .set({
                accountId: input.accountId,
                categoryId: input.categoryId,
                type: input.type,
                amount: String(input.amount),
                currency: input.currency,
                merchant: input.merchant || null,
                notes: input.notes || null,
                date: input.date,
            })
            .where(
                and(
                    eq(transactions.id, input.id),
                    eq(transactions.userId, userId),
                    eq(transactions.status, "completed"),
                ),
            )
            .returning({ id: transactions.id });

        return Boolean(updated);
    }

    async cancelTransactions(userId: string, transactionIds: string[]) {
        const cancelled = await this.tx
            .update(transactions)
            .set({ status: "cancelled" })
            .where(
                and(
                    eq(transactions.userId, userId),
                    inArray(transactions.id, transactionIds),
                    eq(transactions.status, "completed"),
                ),
            )
            .returning({ id: transactions.id });

        return cancelled.length;
    }

    async cancelScheduledOccurrences(userId: string, occurrenceIds: string[]) {
        if (!occurrenceIds.length) {
            return 0;
        }

        const cancelled = await this.tx
            .update(scheduledOccurrences)
            .set({ status: "cancelled" })
            .where(
                and(
                    eq(scheduledOccurrences.userId, userId),
                    inArray(scheduledOccurrences.id, occurrenceIds),
                    eq(scheduledOccurrences.status, "completed"),
                ),
            )
            .returning({ id: scheduledOccurrences.id });

        return cancelled.length;
    }

    async reopenScheduledOccurrences(userId: string, occurrenceIds: string[]) {
        if (!occurrenceIds.length) return 0;

        const reopened = await this.tx
            .update(scheduledOccurrences)
            .set({ status: "scheduled", executedAt: null })
            .where(and(
                eq(scheduledOccurrences.userId, userId),
                inArray(scheduledOccurrences.id, occurrenceIds),
                eq(scheduledOccurrences.status, "completed"),
            ))
            .returning({ id: scheduledOccurrences.id });

        return reopened.length;
    }

    async reopenFinancingInstallments(userId: string, installmentIds: string[]) {
        if (!installmentIds.length) return 0;

        const ownedPlanIds = this.tx
            .select({ id: financingPlans.id })
            .from(financingPlans)
            .where(eq(financingPlans.userId, userId));

        const reopened = await this.tx
            .update(financingInstallments)
            .set({ paidAt: null, paymentTransferGroupId: null })
            .where(and(
                inArray(financingInstallments.id, installmentIds),
                inArray(
                    financingInstallments.financingPlanId,
                    ownedPlanIds,
                ),
            ))
            .returning({
                id: financingInstallments.id,
                financingPlanId: financingInstallments.financingPlanId,
            });

        if (reopened.length) {
            await this.tx
                .update(financingPlans)
                .set({ status: "active" })
                .where(inArray(
                    financingPlans.id,
                    [...new Set(reopened.map((installment) => installment.financingPlanId))],
                ));
        }

        return reopened.length;
    }

    async applyBalanceDelta(account: TransactionAccount, userId: string, delta: number) {
        return applyAccountBalanceDelta(this.tx, account, userId, delta);
    }
}

export class DrizzleTransactionRepository implements TransactionRepository {
    async withinTransaction<T>(work: (scope: TransactionScope) => Promise<T>) {
        return db.transaction((tx) => work(new DrizzleTransactionScope(tx)));
    }
}
