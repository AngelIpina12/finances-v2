import { and, asc, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import {
    categories, financialAccounts, recurringRules,
    scheduledOccurrences,
} from "@/src/db/schema";

export async function getScheduledOccurrenceData(userId: string, now = new Date()) {
    const [accounts, userCategories, occurrences, rules, nextOccurrences] = await Promise.all([
        db
            .select({
                id: financialAccounts.id,
                name: financialAccounts.name,
                type: financialAccounts.type,
                currency: financialAccounts.currency,
                creditLimit: financialAccounts.creditLimit,
                owedAmount: financialAccounts.owedAmount,
                availableCredit: financialAccounts.availableCredit,
            })
            .from(financialAccounts)
            .where(
                and(
                    eq(financialAccounts.userId, userId),
                    eq(financialAccounts.isActive, true),
                    isNull(financialAccounts.deletedAt),
                ),
            )
            .orderBy(asc(financialAccounts.name)),
        db
            .select({
                id: categories.id,
                name: categories.name,
                type: categories.type,
                color: categories.color,
            })
            .from(categories)
            .where(
                and(
                    eq(categories.userId, userId),
                    isNull(categories.deletedAt),
                ),
            )
            .orderBy(asc(categories.sortOrder), asc(categories.name)),
        db
            .select({
                id: scheduledOccurrences.id,
                source: scheduledOccurrences.source,
                accountId: scheduledOccurrences.accountId,
                accountName: financialAccounts.name,
                categoryId: scheduledOccurrences.categoryId,
                categoryName: categories.name,
                categoryColor: categories.color,
                transactionType: scheduledOccurrences.transactionType,
                status: scheduledOccurrences.status,
                name: scheduledOccurrences.name,
                amount: scheduledOccurrences.amount,
                currency: scheduledOccurrences.currency,
                notes: scheduledOccurrences.notes,
                scheduledAt: scheduledOccurrences.scheduledAt,
                executedAt: scheduledOccurrences.executedAt,
                createdAt: scheduledOccurrences.createdAt,
            })
            .from(scheduledOccurrences)
            .innerJoin(
                financialAccounts,
                eq(scheduledOccurrences.accountId, financialAccounts.id),
            )
            .leftJoin(
                categories,
                eq(scheduledOccurrences.categoryId, categories.id),
            )
            .where(eq(scheduledOccurrences.userId, userId))
            .orderBy(
                asc(scheduledOccurrences.status),
                asc(scheduledOccurrences.scheduledAt),
                desc(scheduledOccurrences.createdAt),
            )
            .limit(150),
        db
            .select({
                id: recurringRules.id,
                accountId: recurringRules.accountId,
                accountName: financialAccounts.name,
                categoryId: recurringRules.categoryId,
                categoryName: categories.name,
                transactionType: recurringRules.transactionType,
                frequency: recurringRules.frequency,
                name: recurringRules.name,
                amount: recurringRules.amount,
                currency: recurringRules.currency,
                notes: recurringRules.notes,
                startsAt: recurringRules.startsAt,
                endsAt: recurringRules.endsAt,
                lastGeneratedAt: recurringRules.lastGeneratedAt,
                isActive: recurringRules.isActive,
                createdAt: recurringRules.createdAt,
            })
            .from(recurringRules)
            .innerJoin(financialAccounts, eq(recurringRules.accountId, financialAccounts.id))
            .leftJoin(categories, eq(recurringRules.categoryId, categories.id))
            .where(and(
                eq(recurringRules.userId, userId),
                isNull(recurringRules.deletedAt),
            ))
            .orderBy(desc(recurringRules.isActive), asc(recurringRules.name)),
        db
            .select({
                recurringRuleId: scheduledOccurrences.recurringRuleId,
                scheduledAt: scheduledOccurrences.scheduledAt,
            })
            .from(scheduledOccurrences)
            .where(and(
                eq(scheduledOccurrences.userId, userId),
                eq(scheduledOccurrences.status, "scheduled"),
                gte(scheduledOccurrences.scheduledAt, now),
            ))
            .orderBy(asc(scheduledOccurrences.scheduledAt)),
    ]);

    const nextOccurrenceByRule = new Map<string, Date>();
    for (const occurrence of nextOccurrences) {
        if (occurrence.recurringRuleId && !nextOccurrenceByRule.has(occurrence.recurringRuleId)) {
            nextOccurrenceByRule.set(occurrence.recurringRuleId, occurrence.scheduledAt);
        }
    }

    return {
        accounts: accounts.map((account) => ({
            ...account,
            creditLimit: account.creditLimit === null
                ? null
                : Number(account.creditLimit),
            owedAmount: account.owedAmount === null
                ? null
                : Number(account.owedAmount),
            availableCredit: account.availableCredit === null
                ? null
                : Number(account.availableCredit),
        })),
        categories: userCategories,
        occurrences,
        rules: rules.map((rule) => ({
            ...rule,
            amount: Number(rule.amount),
            nextOccurrenceAt: nextOccurrenceByRule.get(rule.id) ?? null,
        })),
        now,
    };
}

export type ScheduledOccurrenceListItem = Awaited<
    ReturnType<typeof getScheduledOccurrenceData>
>["occurrences"][number];

export type RecurringRuleListItem = Awaited<
    ReturnType<typeof getScheduledOccurrenceData>
>["rules"][number];
