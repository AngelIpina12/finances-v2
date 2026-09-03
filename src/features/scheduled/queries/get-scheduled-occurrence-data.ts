import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import {
    categories, financialAccounts, scheduledOccurrences,
} from "@/src/db/schema";

export async function getScheduledOccurrenceData(userId: string, now = new Date()) {
    const [accounts, userCategories, occurrences] = await Promise.all([
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
    ]);

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
        now,
    };
}

export type ScheduledOccurrenceListItem = Awaited<
    ReturnType<typeof getScheduledOccurrenceData>
>["occurrences"][number];
