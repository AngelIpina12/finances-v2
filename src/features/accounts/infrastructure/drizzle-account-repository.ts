import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import { financialAccounts } from "@/src/db/schema";
import type { AccountRecord, AccountRepository } from "../domain/account-repository";

export class DrizzleAccountRepository implements AccountRepository {
    async create(userId: string, account: AccountRecord) {
        await db.insert(financialAccounts).values({ ...account, userId });
    }

    async update(userId: string, accountId: string, account: AccountRecord) {
        const [updatedAccount] = await db
            .update(financialAccounts)
            .set(account)
            .where(
                and(
                    eq(financialAccounts.id, accountId),
                    eq(financialAccounts.userId, userId),
                    isNull(financialAccounts.deletedAt),
                ),
            )
            .returning({ id: financialAccounts.id });

        return Boolean(updatedAccount);
    }

    async archive(userId: string, accountId: string) {
        const [archivedAccount] = await db
            .update(financialAccounts)
            .set({ isActive: false, deletedAt: new Date() })
            .where(
                and(
                    eq(financialAccounts.id, accountId),
                    eq(financialAccounts.userId, userId),
                    isNull(financialAccounts.deletedAt),
                ),
            )
            .returning({ id: financialAccounts.id });

        return Boolean(archivedAccount);
    }
}
