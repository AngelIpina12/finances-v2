import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
    categories, financialAccounts, transactions
} from "@/src/db/schema";
import type {
    TransactionAccount, TransactionRepository, TransactionScope,
} from "../domain/transaction-repository";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

class DrizzleTransactionScope implements TransactionScope {
    constructor(private readonly tx: DatabaseTransaction) { }

    async findActiveAccount(userId: string, accountId: string) {
        const [account] = await this.tx
            .select({
                id: financialAccounts.id,
                type: financialAccounts.type,
                currency: financialAccounts.currency,
            })
            .from(financialAccounts)
            .where(
                and(
                    eq(financialAccounts.id, accountId),
                    eq(financialAccounts.userId, userId),
                    eq(financialAccounts.isActive, true),
                    isNull(financialAccounts.deletedAt),
                ),
            )
            .limit(1);

        return account as TransactionAccount | undefined;
    }

    async categoryBelongsToType(userId: string, categoryId: string, type: "income" | "expense") {
        const [category] = await this.tx
            .select({ id: categories.id })
            .from(categories)
            .where(
                and(
                    eq(categories.id, categoryId),
                    eq(categories.userId, userId),
                    eq(categories.type, type),
                    isNull(categories.deletedAt),
                ),
            )
            .limit(1);

        return Boolean(category);
    }

    async insertCompletedTransaction(input: Parameters<TransactionScope["insertCompletedTransaction"]>[0]) {
        await this.tx.insert(transactions).values({
            userId: input.userId,
            accountId: input.accountId,
            categoryId: input.categoryId,
            type: input.type,
            status: "completed",
            amount: String(input.amount),
            currency: input.currency,
            merchant: input.merchant || null,
            notes: input.notes || null,
            date: input.date,
        });
    }

    async applyBalanceDelta(account: TransactionAccount, userId: string, delta: number) {
        const values = account.type === "credit"
            ? {
                currentBalance: sql`${financialAccounts.currentBalance} + ${delta}`,
                owedAmount: sql`coalesce(${financialAccounts.owedAmount}, 0) + ${delta}`,
                availableCredit: sql`greatest(0, coalesce(${financialAccounts.creditLimit}, 0) - (coalesce(${financialAccounts.owedAmount}, 0) + ${delta}))`,
            }
            : {
                currentBalance: sql`${financialAccounts.currentBalance} + ${delta}`,
            };

        const [updatedAccount] = await this.tx
            .update(financialAccounts)
            .set(values)
            .where(
                and(
                    eq(financialAccounts.id, account.id),
                    eq(financialAccounts.userId, userId),
                ),
            )
            .returning({ id: financialAccounts.id });

        return Boolean(updatedAccount);
    }
}

export class DrizzleTransactionRepository implements TransactionRepository {
    async withinTransaction<T>(work: (scope: TransactionScope) => Promise<T>) {
        return db.transaction((tx) => work(new DrizzleTransactionScope(tx)));
    }
}
