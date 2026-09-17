import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { financialAccounts } from "@/src/db/schema";
import type {
    AccountRecord, AccountRepository, AccountUpdateRecord,
} from "../domain/account-repository";

export class DrizzleAccountRepository implements AccountRepository {
    async create(userId: string, account: AccountRecord) {
        await db.insert(financialAccounts).values({ ...account, userId });
    }

    async update(userId: string, accountId: string, account: AccountUpdateRecord) {
        const [updatedAccount] = await db
            .update(financialAccounts)
            .set({
                ...account,
                // El límite puede cambiar, pero la deuda procede de las
                // transacciones. Recalculamos sólo el crédito disponible.
                availableCredit: account.type === "credit"
                    ? sql`greatest(0, ${account.creditLimit ?? "0"}::numeric - coalesce(${financialAccounts.owedAmount}, 0))`
                    : null,
            })
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
