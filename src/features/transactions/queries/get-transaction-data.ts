import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import { categories, financialAccounts, transactions } from "@/src/db/schema";

export async function getTransactionFormData(userId: string) {
  const [accounts, userCategories] = await Promise.all([
    db
      .select({
        id: financialAccounts.id,
        name: financialAccounts.name,
        type: financialAccounts.type,
        currency: financialAccounts.currency,
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
  return { accounts, categories: userCategories };
}

export async function getRecentTransactions(userId: string) {
  return db
    .select({
      id: transactions.id,
      type: transactions.type,
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
        eq(transactions.status, "completed"),
      ),
    )
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(50);
}
