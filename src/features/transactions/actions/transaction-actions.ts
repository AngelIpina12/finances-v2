"use server";

import {
    and, eq, isNull,
    sql
} from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/src/db";
import {
    categories, financialAccounts, transactions
} from "@/src/db/schema";
import { requireAuth } from "@/src/lib/auth-server";
import { defaultCategories } from "../constants/default-categories";
import { transactionFormSchema, type TransactionFormInput } from "../schemas/transaction.schema";

export async function bootstrapDefaultCategories() {
    const { session } = await requireAuth();

    if (!session) return { success: false, message: "Tu sesión expiró." };

    await db
        .insert(categories)
        .values(
            defaultCategories.map((category) => ({
                ...category,
                userId: session.user.id,
                isSystem: true,
            })),
        )
        .onConflictDoNothing();
    revalidatePath("/transactions");

    return { success: true, message: "Tus categorías iniciales están listas." };
}

export async function createTransaction(input: TransactionFormInput) {
    const parsed = transactionFormSchema.safeParse(input);

    if (!parsed.success)
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
        };

    const { session } = await requireAuth();

    if (!session) return { success: false, message: "Tu sesión expiró." };

    const data = parsed.data;

    try {
        await db.transaction(async (tx) => {
            const [account] = await tx
                .select({
                    id: financialAccounts.id,
                    type: financialAccounts.type,
                    currency: financialAccounts.currency,
                })
                .from(financialAccounts)
                .where(
                    and(
                        eq(financialAccounts.id, data.accountId),
                        eq(financialAccounts.userId, session.user.id),
                        eq(financialAccounts.isActive, true),
                        isNull(financialAccounts.deletedAt),
                    ),
                )
                .limit(1);

            if (!account) throw new Error("No puedes usar esa cuenta.");

            const [category] = await tx
                .select({ id: categories.id })
                .from(categories)
                .where(
                    and(
                        eq(categories.id, data.categoryId),
                        eq(categories.userId, session.user.id),
                        eq(categories.type, data.type),
                        isNull(categories.deletedAt),
                    ),
                )
                .limit(1);

            if (!category) {
                throw new Error("La categoría no corresponde al tipo de movimiento.");
            }

            const amount = String(data.amount);
            const delta =
                account.type === "credit"
                    ? data.type === "expense"
                        ? data.amount
                        : -data.amount
                    : data.type === "income"
                        ? data.amount
                        : -data.amount;

            await tx
                .insert(transactions)
                .values({
                    userId: session.user.id,
                    accountId: account.id,
                    categoryId: category.id,
                    type: data.type,
                    status: "completed",
                    amount,
                    currency: account.currency,
                    merchant: data.merchant || null,
                    notes: data.notes || null,
                    date: data.date,
                });

            const updateValues =
                account.type === "credit"
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
                .set(updateValues)
                .where(
                    and(
                        eq(financialAccounts.id, account.id),
                        eq(financialAccounts.userId, session.user.id),
                    ),
                )
                .returning({ id: financialAccounts.id });

            if (!updatedAccount) {
                throw new Error("No fue posible actualizar el saldo.");
            }
        });
    } catch (error) {
        return {
            success: false,
            message:
                error instanceof Error
                    ? error.message
                    : "No fue posible guardar el movimiento.",
        };
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return { success: true, message: "Movimiento registrado." };
}
