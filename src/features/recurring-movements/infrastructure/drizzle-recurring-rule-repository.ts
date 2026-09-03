import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import {
    categories, financialAccounts, recurringRules,
    scheduledOccurrences,
} from "@/src/db/schema";
import type { TransactionAccount } from "@/src/features/transactions/domain/transaction-repository";
import type {
    RecurringRule, RecurringRuleRepository, RecurringRuleScope,
} from "../domain/recurring-rule-repository";

type StoredCalendarEntry = { scheduledAt: string; amount?: number };
type StoredDateOverride = StoredCalendarEntry & { originalScheduledAt: string };

function toStoredCalendarEntries(entries: RecurringRule["calendarEntries"]) {
    return entries.map((entry) => ({
        scheduledAt: entry.scheduledAt.toISOString(),
        ...(entry.amount === undefined ? {} : { amount: entry.amount }),
    }));
}

function toStoredDateOverrides(entries: RecurringRule["dateOverrides"]) {
    return entries.map((entry) => ({
        originalScheduledAt: entry.originalScheduledAt.toISOString(),
        scheduledAt: entry.scheduledAt.toISOString(),
        ...(entry.amount === undefined ? {} : { amount: entry.amount }),
    }));
}

function toRule(rule: typeof recurringRules.$inferSelect): RecurringRule {
    return {
        ...rule,
        transactionType: rule.transactionType as RecurringRule["transactionType"],
        frequency: rule.frequency as RecurringRule["frequency"],
        amountStrategy: rule.amountStrategy as RecurringRule["amountStrategy"],
        fifthOccurrencePolicy: rule.fifthOccurrencePolicy as RecurringRule["fifthOccurrencePolicy"],
        amount: Number(rule.amount),
        periodTotal: rule.periodTotal === null ? null : Number(rule.periodTotal),
        fifthOccurrenceAmount: rule.fifthOccurrenceAmount === null
            ? null
            : Number(rule.fifthOccurrenceAmount),
        currency: rule.currency as RecurringRule["currency"],
        calendarEntries: (rule.calendarEntries as StoredCalendarEntry[]).map((entry) => ({
            scheduledAt: new Date(entry.scheduledAt),
            amount: entry.amount,
        })),
        dateOverrides: (rule.dateOverrides as StoredDateOverride[]).map((entry) => ({
            originalScheduledAt: new Date(entry.originalScheduledAt),
            scheduledAt: new Date(entry.scheduledAt),
            amount: entry.amount,
        })),
    };
}

class DrizzleRecurringRuleScope implements RecurringRuleScope {
    constructor(private readonly tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) { }

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
                creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
                owedAmount: account.owedAmount === null ? null : Number(account.owedAmount),
            } as TransactionAccount
            : undefined;
    }

    async categoryBelongsToType(userId: string, categoryId: string, type: "income" | "expense") {
        const [category] = await this.tx
            .select({ id: categories.id })
            .from(categories)
            .where(and(
                eq(categories.id, categoryId),
                eq(categories.userId, userId),
                eq(categories.type, type),
                isNull(categories.deletedAt),
            ))
            .limit(1);

        return Boolean(category);
    }

    async createRule(input: Parameters<RecurringRuleScope["createRule"]>[0]) {
        const [rule] = await this.tx
            .insert(recurringRules)
            .values({
                ...input,
                amount: String(input.amount),
                amountStrategy: input.amountStrategy,
                fifthOccurrencePolicy: input.fifthOccurrencePolicy,
                periodTotal: input.periodTotal === undefined ? null : String(input.periodTotal),
                fifthOccurrenceAmount: input.fifthOccurrenceAmount === undefined
                    ? null
                    : String(input.fifthOccurrenceAmount),
                notes: input.notes || null,
                semimonthlyFirstDay: input.semimonthlyFirstDay ?? null,
                semimonthlySecondDay: input.semimonthlySecondDay ?? null,
                calendarEntries: toStoredCalendarEntries(input.calendarEntries ?? []),
                dateOverrides: toStoredDateOverrides(input.dateOverrides ?? []),
                endsAt: input.endsAt ?? null,
                endMode: input.endsAt ? "on_date" : "never",
            })
            .returning();

        return toRule(rule);
    }

    async findRuleForUpdate(userId: string, ruleId: string) {
        const [rule] = await this.tx
            .select()
            .from(recurringRules)
            .where(and(
                eq(recurringRules.id, ruleId),
                eq(recurringRules.userId, userId),
                isNull(recurringRules.deletedAt),
            ))
            .limit(1)
            .for("update");

        return rule ? toRule(rule) : undefined;
    }

    async updateRule(userId: string, ruleId: string, input: Parameters<RecurringRuleScope["updateRule"]>[2]) {
        const [rule] = await this.tx
            .update(recurringRules)
            .set({
                accountId: input.accountId,
                categoryId: input.categoryId,
                transactionType: input.transactionType,
                frequency: input.frequency,
                name: input.name,
                amount: String(input.amount),
                amountStrategy: input.amountStrategy,
                fifthOccurrencePolicy: input.fifthOccurrencePolicy,
                periodTotal: input.periodTotal === undefined ? null : String(input.periodTotal),
                fifthOccurrenceAmount: input.fifthOccurrenceAmount === undefined
                    ? null
                    : String(input.fifthOccurrenceAmount),
                currency: input.currency,
                notes: input.notes || null,
                semimonthlyFirstDay: input.semimonthlyFirstDay ?? null,
                semimonthlySecondDay: input.semimonthlySecondDay ?? null,
                calendarEntries: toStoredCalendarEntries(input.calendarEntries ?? []),
                dateOverrides: toStoredDateOverrides(input.dateOverrides ?? []),
                startsAt: input.startsAt,
                endsAt: input.endsAt ?? null,
                endMode: input.endsAt ? "on_date" : "never",
            })
            .where(and(
                eq(recurringRules.id, ruleId),
                eq(recurringRules.userId, userId),
                isNull(recurringRules.deletedAt),
            ))
            .returning();

        return rule ? toRule(rule) : undefined;
    }

    async setActive(userId: string, ruleId: string, isActive: boolean) {
        const [rule] = await this.tx
            .update(recurringRules)
            .set({ isActive })
            .where(and(
                eq(recurringRules.id, ruleId),
                eq(recurringRules.userId, userId),
                isNull(recurringRules.deletedAt),
            ))
            .returning();

        return rule ? toRule(rule) : undefined;
    }

    async archiveRule(userId: string, ruleId: string) {
        const [rule] = await this.tx
            .update(recurringRules)
            .set({ isActive: false, deletedAt: new Date() })
            .where(and(
                eq(recurringRules.id, ruleId),
                eq(recurringRules.userId, userId),
                isNull(recurringRules.deletedAt),
            ))
            .returning({ id: recurringRules.id });

        return Boolean(rule);
    }

    async findActiveRules(userId?: string, ruleId?: string) {
        const conditions = [
            eq(recurringRules.isActive, true),
            isNull(recurringRules.deletedAt),
        ];

        if (userId) {
            conditions.push(eq(recurringRules.userId, userId));
        }

        if (ruleId) {
            conditions.push(eq(recurringRules.id, ruleId));
        }

        const rules = await this.tx
            .select()
            .from(recurringRules)
            .where(and(...conditions))
            .for("update");

        return rules.map(toRule);
    }

    async insertGeneratedOccurrences(input: Parameters<RecurringRuleScope["insertGeneratedOccurrences"]>[0]) {
        if (!input.length) return 0;

        const inserted = await this.tx
            .insert(scheduledOccurrences)
            .values(input.map(({
                rule, sequence, originalScheduledAt, scheduledAt, amount,
            }) => ({
                userId: rule.userId,
                source: "recurring_rule" as const,
                recurringRuleId: rule.id,
                sequence,
                accountId: rule.accountId,
                categoryId: rule.categoryId,
                transactionType: rule.transactionType,
                name: rule.name,
                amount: String(amount),
                currency: rule.currency,
                notes: rule.notes,
                originalScheduledAt,
                scheduledAt,
            })))
            .onConflictDoNothing()
            .returning({ id: scheduledOccurrences.id });

        return inserted.length;
    }

    async markGenerated(userId: string, ruleId: string, generatedAt: Date) {
        await this.tx
            .update(recurringRules)
            .set({ lastGeneratedAt: generatedAt })
            .where(and(
                eq(recurringRules.id, ruleId),
                eq(recurringRules.userId, userId),
            ));
    }
}

export class DrizzleRecurringRuleRepository implements RecurringRuleRepository {
    async withinTransaction<T>(work: (scope: RecurringRuleScope) => Promise<T>) {
        return db.transaction((tx) => work(new DrizzleRecurringRuleScope(tx)));
    }
}
