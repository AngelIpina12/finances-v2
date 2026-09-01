import { and, eq, isNull, max, ne, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { categories } from "@/src/db/schema";
import { transactions } from "@/src/db/schema";
import type {
    CategoryInput, CategoryRecord, CategoryRepository,
    CategoryType,
} from "../domain/category-repository";

export class DrizzleCategoryRepository implements CategoryRepository {
    async findActive(userId: string, categoryId: string) {
        const [category] = await db
            .select({ type: categories.type })
            .from(categories)
            .where(
                and(
                    eq(categories.id, categoryId),
                    eq(categories.userId, userId),
                    isNull(categories.deletedAt),
                ),
            )
            .limit(1);

        if (!category || category.type === "transfer") return undefined;
        return { type: category.type };
    }

    async hasTransactions(userId: string, categoryId: string) {
        const [transaction] = await db
            .select({ id: transactions.id })
            .from(transactions)
            .where(
                and(
                    eq(transactions.userId, userId),
                    eq(transactions.categoryId, categoryId),
                ),
            )
            .limit(1);

        return Boolean(transaction);
    }

    async activeNameExists(userId: string, type: CategoryType, name: string, excludeId?: string) {
        const filters = [
            eq(categories.userId, userId),
            eq(categories.type, type),
            sql`lower(${categories.name}) = lower(${name})`,
            isNull(categories.deletedAt),
        ];

        if (excludeId) filters.push(ne(categories.id, excludeId));

        const [category] = await db
            .select({ id: categories.id })
            .from(categories)
            .where(and(...filters))
            .limit(1);

        return Boolean(category);
    }

    async nextSortOrder(userId: string, type: CategoryType) {
        const [result] = await db
            .select({ value: max(categories.sortOrder) })
            .from(categories)
            .where(
                and(
                    eq(categories.userId, userId),
                    eq(categories.type, type),
                    isNull(categories.deletedAt),
                ),
            );

        return (result?.value ?? 0) + 10;
    }

    async create(userId: string, category: CategoryRecord) {
        await db.insert(categories).values({
            userId,
            name: category.name,
            type: category.type,
            color: category.color,
            iconUrl: category.icon,
            sortOrder: category.sortOrder,
            isSystem: category.isSystem,
        });
    }

    async update(userId: string, categoryId: string, category: CategoryInput) {
        const [updatedCategory] = await db
            .update(categories)
            .set({
                name: category.name,
                type: category.type,
                color: category.color,
                iconUrl: category.icon,
            })
            .where(
                and(
                    eq(categories.id, categoryId),
                    eq(categories.userId, userId),
                    isNull(categories.deletedAt),
                ),
            )
            .returning({ id: categories.id });

        return Boolean(updatedCategory);
    }

    async archive(userId: string, categoryId: string) {
        const [archivedCategory] = await db
            .update(categories)
            .set({ deletedAt: new Date() })
            .where(
                and(
                    eq(categories.id, categoryId),
                    eq(categories.userId, userId),
                    isNull(categories.deletedAt),
                ),
            )
            .returning({ id: categories.id });

        return Boolean(archivedCategory);
    }

    async bootstrap(userId: string, defaults: readonly CategoryRecord[]) {
        await db
            .insert(categories)
            .values(
                defaults.map((category) => ({
                    userId,
                    name: category.name,
                    type: category.type,
                    color: category.color,
                    iconUrl: category.icon,
                    sortOrder: category.sortOrder,
                    isSystem: true,
                })),
            )
            .onConflictDoNothing();
    }
}
