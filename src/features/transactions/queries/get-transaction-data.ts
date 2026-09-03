import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import {
    categories, financialAccounts, transactions
} from "@/src/db/schema";

export async function getTransactionFormData(userId: string) {
    const [accounts, userCategories] = await Promise.all([
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
            .where(and(eq(categories.userId, userId), isNull(categories.deletedAt)))
            .orderBy(asc(categories.sortOrder), asc(categories.name)),
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
    };
}

export async function getTransactions(userId: string) {
    return db
        .select({
            id: transactions.id,
            accountId: transactions.accountId,
            categoryId: transactions.categoryId,
            transferGroupId: transactions.transferGroupId,
            transferDirection: transactions.transferDirection,
            type: transactions.type,
            status: transactions.status,
            amount: transactions.amount,
            currency: transactions.currency,
            date: transactions.date,
            merchant: transactions.merchant,
            notes: transactions.notes,
            accountName: financialAccounts.name,
            categoryName: categories.name,
            categoryColor: categories.color,
        })
        .from(transactions)
        .innerJoin(
            financialAccounts,
            eq(transactions.accountId, financialAccounts.id),
        )
        .leftJoin(categories, eq(transactions.categoryId, categories.id))
        .where(
            and(
                eq(transactions.userId, userId),
                inArray(transactions.status, ["completed", "cancelled"]),
            ),
        )
        .orderBy(desc(transactions.date), desc(transactions.createdAt))
        .limit(100);
}

export type TransactionListItem = Awaited<ReturnType<typeof getTransactions>>[number];
