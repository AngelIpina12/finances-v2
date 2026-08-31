"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/src/db";
import { categories } from "@/src/db/schema";
import { requireAuth } from "@/src/lib/auth-server";
import { defaultCategories } from "../constants/default-categories";
import { transactionFormSchema, TransactionFormData } from "../schemas/transaction.schema";
import {
    CreateTransactionError,
    CreateTransactionUseCase,
} from "../application/use-cases/create-transaction";
import { DrizzleTransactionRepository } from "../infrastructure/drizzle-transaction-repository";

const createTransactionUseCase = new CreateTransactionUseCase(
    new DrizzleTransactionRepository(),
);

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

export async function createTransaction(input: TransactionFormData) {
    const parsed = transactionFormSchema.safeParse(input);

    if (!parsed.success)
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
        };

    const { session } = await requireAuth();

    if (!session) return { success: false, message: "Tu sesión expiró." };

    try {
        await createTransactionUseCase.execute(session.user.id, parsed.data);
    } catch (error) {
        return {
            success: false,
            message:
                error instanceof CreateTransactionError
                    ? error.message
                    : "No fue posible guardar el movimiento.",
        };
    }

    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return { success: true, message: "Movimiento registrado." };
}
