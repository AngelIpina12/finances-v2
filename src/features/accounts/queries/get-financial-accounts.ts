import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import { financialAccounts } from "@/src/db/schema";

export async function getFinancialAccounts(userId: string) {
    return db
        .select()
        .from(financialAccounts)
        .where(
            and(
                eq(financialAccounts.userId, userId),
                isNull(financialAccounts.deletedAt),
            ),
        )
        .orderBy(desc(financialAccounts.createdAt));
}
