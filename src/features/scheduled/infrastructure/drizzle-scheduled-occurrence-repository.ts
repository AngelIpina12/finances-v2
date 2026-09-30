import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import {
    categories, financialAccounts, recurringRules, scheduledOccurrences,
    transactions,
} from "@/src/db/schema";
import type { TransactionAccount } from "@/src/features/transactions/domain/transaction-repository";
import { applyAccountBalanceDelta, type DatabaseTransaction } from "@/src/features/transactions/infrastructure/apply-account-balance-delta";
import type {
    ScheduledOccurrence, ScheduledOccurrenceRepository, ScheduledOccurrenceScope,
} from "../domain/scheduled-occurrence-repository";

type StoredDateOverride = {
    originalScheduledAt: string;
    scheduledAt: string;
    amount?: number;
};

class DrizzleScheduledOccurrenceScope implements ScheduledOccurrenceScope {
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
                currentBalance: financialAccounts.currentBalance,
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
                currentBalance: Number(account.currentBalance),
            } as TransactionAccount
            : undefined;
    }

    async categoryBelongsToType(
        userId: string,
        categoryId: string,
        type: "income" | "expense",
        options: { activeOnly?: boolean } = {},
    ) {
        const conditions = [
            eq(categories.id, categoryId),
            eq(categories.userId, userId),
            eq(categories.type, type),
        ];

        if (options.activeOnly) {
            conditions.push(isNull(categories.deletedAt));
        }

        const [category] = await this.tx
            .select({ id: categories.id })
            .from(categories)
            .where(and(...conditions))
            .limit(1);

        return Boolean(category);
    }

    async findOccurrenceForUpdate(userId: string, occurrenceId: string) {
        const [occurrence] = await this.tx
            .select({
                id: scheduledOccurrences.id,
                source: scheduledOccurrences.source,
                recurringRuleId: scheduledOccurrences.recurringRuleId,
                accountId: scheduledOccurrences.accountId,
                categoryId: scheduledOccurrences.categoryId,
                transactionType: scheduledOccurrences.transactionType,
                status: scheduledOccurrences.status,
                name: scheduledOccurrences.name,
                amount: scheduledOccurrences.amount,
                currency: scheduledOccurrences.currency,
                notes: scheduledOccurrences.notes,
                originalScheduledAt: scheduledOccurrences.originalScheduledAt,
                scheduledAt: scheduledOccurrences.scheduledAt,
            })
            .from(scheduledOccurrences)
            .where(
                and(
                    eq(scheduledOccurrences.id, occurrenceId),
                    eq(scheduledOccurrences.userId, userId),
                ),
            )
            .limit(1)
            .for("update");

        return occurrence ? {
            ...occurrence,
            source: occurrence.source as ScheduledOccurrence["source"],
            transactionType: occurrence.transactionType as ScheduledOccurrence["transactionType"],
            amount: Number(occurrence.amount),
        } : undefined;
    }

    async insertOccurrence(input: Parameters<ScheduledOccurrenceScope["insertOccurrence"]>[0]) {
        await this.tx.insert(scheduledOccurrences).values({
            userId: input.userId,
            source: "manual",
            accountId: input.accountId,
            categoryId: input.categoryId,
            transactionType: input.transactionType,
            name: input.name,
            amount: String(input.amount),
            currency: input.currency,
            notes: input.notes || null,
            originalScheduledAt: input.scheduledAt,
            scheduledAt: input.scheduledAt,
        });
    }

    async insertCompletedTransaction(input: Parameters<ScheduledOccurrenceScope["insertCompletedTransaction"]>[0]) {
        await this.tx.insert(transactions).values({
            userId: input.userId,
            accountId: input.occurrence.accountId,
            categoryId: input.occurrence.categoryId,
            scheduledOccurrenceId: input.occurrence.id,
            type: input.occurrence.transactionType,
            status: "completed",
            amount: String(input.occurrence.amount),
            currency: input.occurrence.currency,
            merchant: input.occurrence.name,
            notes: input.occurrence.notes,
            date: input.executedAt,
        });
    }

    async applyBalanceDelta(account: TransactionAccount, userId: string, delta: number) {
        return applyAccountBalanceDelta(this.tx, account, userId, delta);
    }

    async rescheduleOccurrence(userId: string, occurrenceId: string, scheduledAt: Date) {
        const [updated] = await this.tx
            .update(scheduledOccurrences)
            .set({ scheduledAt })
            .where(
                and(
                    eq(scheduledOccurrences.id, occurrenceId),
                    eq(scheduledOccurrences.userId, userId),
                    eq(scheduledOccurrences.status, "scheduled"),
                ),
            )
            .returning({ id: scheduledOccurrences.id });

        return Boolean(updated);
    }

    async recordRuleDateOverride(input: Parameters<ScheduledOccurrenceScope["recordRuleDateOverride"]>[0]) {
        const [rule] = await this.tx
            .select({
                startsAt: recurringRules.startsAt,
                endsAt: recurringRules.endsAt,
                dateOverrides: recurringRules.dateOverrides,
            })
            .from(recurringRules)
            .where(and(
                eq(recurringRules.id, input.ruleId),
                eq(recurringRules.userId, input.userId),
            ))
            .limit(1)
            .for("update");

        if (!rule) return false;
        // La recurrencia descarta las fechas fuera de su vigencia al regenerarse.
        if (input.scheduledAt < rule.startsAt || (rule.endsAt && input.scheduledAt > rule.endsAt)) {
            return false;
        }

        const originalKey = input.originalScheduledAt.toISOString();
        const overrides = rule.dateOverrides as StoredDateOverride[];
        const existing = overrides.find((entry) => (
            new Date(entry.originalScheduledAt).getTime() === input.originalScheduledAt.getTime()
        ));
        const others = overrides.filter((entry) => entry !== existing);
        const returnsToOriginalDate = input.scheduledAt.getTime() === input.originalScheduledAt.getTime();
        // Si vuelve a su fecha original sólo se conserva el ajuste de monto.
        const next = returnsToOriginalDate && existing?.amount === undefined
            ? others
            : [...others, {
                originalScheduledAt: originalKey,
                scheduledAt: input.scheduledAt.toISOString(),
                ...(existing?.amount === undefined ? {} : { amount: existing.amount }),
            }];

        await this.tx
            .update(recurringRules)
            .set({ dateOverrides: next })
            .where(eq(recurringRules.id, input.ruleId));

        return true;
    }

    async transitionOccurrence(
        userId: string,
        occurrenceId: string,
        status: "completed" | "skipped" | "cancelled",
        executedAt?: Date,
    ) {
        const [updated] = await this.tx
            .update(scheduledOccurrences)
            .set({
                status,
                executedAt: status === "completed" ? executedAt : null,
            })
            .where(
                and(
                    eq(scheduledOccurrences.id, occurrenceId),
                    eq(scheduledOccurrences.userId, userId),
                    eq(scheduledOccurrences.status, "scheduled"),
                ),
            )
            .returning({ id: scheduledOccurrences.id });

        return Boolean(updated);
    }
}

export class DrizzleScheduledOccurrenceRepository
    implements ScheduledOccurrenceRepository {
    async withinTransaction<T>(work: (scope: ScheduledOccurrenceScope) => Promise<T>) {
        return db.transaction((tx) => (
            work(new DrizzleScheduledOccurrenceScope(tx))
        ));
    }
}
