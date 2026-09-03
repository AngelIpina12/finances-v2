import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { financialAccounts } from "@/src/db/schema";
import type { TransactionAccount } from "../domain/transaction-repository";

export type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function applyAccountBalanceDelta(
    tx: DatabaseTransaction,
    account: TransactionAccount,
    userId: string,
    delta: number,
) {
    const values = account.type === "credit"
        ? {
            currentBalance: sql`${financialAccounts.currentBalance} + ${delta}`,
            owedAmount: sql`coalesce(${financialAccounts.owedAmount}, 0) + ${delta}`,
            availableCredit: sql`greatest(0, coalesce(${financialAccounts.creditLimit}, 0) - (coalesce(${financialAccounts.owedAmount}, 0) + ${delta}))`,
        }
        : {
            currentBalance: sql`${financialAccounts.currentBalance} + ${delta}`,
        };

    const [updatedAccount] = await tx
        .update(financialAccounts)
        .set(values)
        .where(
            and(
                eq(financialAccounts.id, account.id),
                eq(financialAccounts.userId, userId),
                isNull(financialAccounts.deletedAt),
            ),
        )
        .returning({ id: financialAccounts.id });

    return Boolean(updatedAccount);
}
