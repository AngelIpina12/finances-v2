"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/src/lib/auth-server";
import { getTransactions } from "../queries/get-transaction-data";
import { CancelTransactionUseCase } from "../application/use-cases/cancel-transaction";
import { CreateTransactionUseCase } from "../application/use-cases/create-transaction";
import { CreateTransferUseCase } from "../application/use-cases/create-transfer";
import { UpdateTransactionUseCase } from "../application/use-cases/update-transaction";
import { TransactionError } from "../application/transaction-error";
import { InsufficientFundsError, type FundsImpact } from "../domain/transaction-rules";
import { DrizzleTransactionRepository } from "../infrastructure/drizzle-transaction-repository";
import {
    transactionFormSchema, transactionIdSchema, type TransactionFormData,
} from "../schemas/transaction.schema";
import { transferFormSchema, type TransferFormData } from "../schemas/transfer.schema";

const repository = new DrizzleTransactionRepository();
const createTransactionUseCase = new CreateTransactionUseCase(repository);
const updateTransactionUseCase = new UpdateTransactionUseCase(repository);
const cancelTransactionUseCase = new CancelTransactionUseCase(repository);
const createTransferUseCase = new CreateTransferUseCase(repository);

type ActionResult = {
    success: boolean;
    message: string;
    insufficientFunds?: FundsImpact["kind"];
};

function revalidateFinancialViews() {
    revalidatePath("/budgets");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/forecast");
}

function mutationError(error: unknown, fallback: string): ActionResult {
    if (error instanceof InsufficientFundsError) {
        return { success: false, message: error.message, insufficientFunds: error.kind };
    }

    return {
        success: false,
        message: error instanceof TransactionError ? error.message : fallback,
    };
}

export async function saveTransaction(input: TransactionFormData): Promise<ActionResult> {
    const parsed = transactionFormSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
        };
    }

    const { session } = await requireAuth();

    if (!session) {
        return { success: false, message: "Tu sesión expiró." };
    }

    try {
        if (parsed.data.id) {
            await updateTransactionUseCase.execute(session.user.id, {
                ...parsed.data,
                id: parsed.data.id,
            });
        } else {
            await createTransactionUseCase.execute(session.user.id, parsed.data);
        }
    } catch (error) {
        return mutationError(error, "No fue posible guardar el movimiento.");
    }

    revalidateFinancialViews();

    return {
        success: true,
        message: parsed.data.id ? "Movimiento actualizado." : "Movimiento registrado.",
    };
}

export async function createTransaction(input: TransactionFormData) {
    return saveTransaction(input);
}

export async function cancelTransaction(transactionId: string): Promise<ActionResult> {
    const parsed = transactionIdSchema.safeParse(transactionId);

    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const { session } = await requireAuth();

    if (!session) {
        return { success: false, message: "Tu sesión expiró." };
    }

    try {
        await cancelTransactionUseCase.execute(session.user.id, parsed.data);
    } catch (error) {
        return mutationError(error, "No fue posible cancelar el movimiento.");
    }

    revalidateFinancialViews();

    return { success: true, message: "Movimiento cancelado y saldo actualizado." };
}

export async function loadMoreTransactions(offset: number) {
    const { session } = await requireAuth();

    if (!session) {
        return { transactions: [], hasMore: false };
    }

    return getTransactions(session.user.id, offset);
}

export async function createTransfer(input: TransferFormData): Promise<ActionResult> {
    const parsed = transferFormSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
        };
    }

    const { session } = await requireAuth();

    if (!session) {
        return { success: false, message: "Tu sesión expiró." };
    }

    try {
        await createTransferUseCase.execute(session.user.id, parsed.data);
    } catch (error) {
        return mutationError(error, "No fue posible realizar la transferencia.");
    }

    revalidateFinancialViews();

    return { success: true, message: "Transferencia realizada." };
}
