import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import { categories, transactions } from "@/src/db/schema";

export async function getCategories(userId: string) {
    return db
        .select({
            id: categories.id,
            name: categories.name,
            type: categories.type,
            color: categories.color,
            icon: categories.iconUrl,
            sortOrder: categories.sortOrder,
            isSystem: categories.isSystem,
            transactionCount: count(transactions.id),
        })
        .from(categories)
        .leftJoin(transactions, eq(transactions.categoryId, categories.id))
        .where(
            and(
                eq(categories.userId, userId),
                inArray(categories.type, ["expense", "income"]),
                isNull(categories.deletedAt),
            ),
        )
        .groupBy(categories.id)
        .orderBy(asc(categories.type), asc(categories.sortOrder), asc(categories.name));
}

export type CategoryListItem = Awaited<ReturnType<typeof getCategories>>[number];
