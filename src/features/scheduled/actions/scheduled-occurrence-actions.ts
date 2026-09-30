"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/src/lib/auth-server";
import { CreateScheduledOccurrenceUseCase } from "../application/use-cases/create-scheduled-occurrence";
import { CompleteScheduledOccurrenceUseCase } from "../application/use-cases/complete-scheduled-occurrence";
import { RescheduleScheduledOccurrenceUseCase } from "../application/use-cases/reschedule-scheduled-occurrence";
import { TransitionScheduledOccurrenceUseCase } from "../application/use-cases/transition-scheduled-occurrence";
import { ScheduledOccurrenceError } from "../application/scheduled-occurrence-error";
import { InsufficientFundsError, type FundsImpact } from "@/src/features/transactions/domain/transaction-rules";
import { DrizzleScheduledOccurrenceRepository } from "../infrastructure/drizzle-scheduled-occurrence-repository";
import {
    completeScheduledOccurrenceSchema, rescheduleScheduledOccurrenceSchema, scheduledOccurrenceFormSchema,
    scheduledOccurrenceIdSchema, type ScheduledOccurrenceFormData,
} from "../schemas/scheduled-occurrence.schema";

const repository = new DrizzleScheduledOccurrenceRepository();
const createUseCase = new CreateScheduledOccurrenceUseCase(repository);
const completeUseCase = new CompleteScheduledOccurrenceUseCase(repository);
const skipUseCase = new TransitionScheduledOccurrenceUseCase(repository, "skipped");
const cancelUseCase = new TransitionScheduledOccurrenceUseCase(repository, "cancelled");
const rescheduleUseCase = new RescheduleScheduledOccurrenceUseCase(repository);

type ActionResult = {
    success: boolean;
    message: string;
    insufficientFunds?: FundsImpact["kind"];
};

function revalidateFinancialViews() {
    revalidatePath("/scheduled");
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
        message: error instanceof ScheduledOccurrenceError
            ? error.message
            : fallback,
    };
}

async function getAuthenticatedUserId() {
    const { session } = await requireAuth();
    return session?.user.id;
}

export async function createScheduledOccurrence(input: ScheduledOccurrenceFormData): Promise<ActionResult> {
    const parsed = scheduledOccurrenceFormSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
        };
    }

    const userId = await getAuthenticatedUserId();

    if (!userId) {
        return { success: false, message: "Tu sesión expiró." };
    }

    try {
        await createUseCase.execute(userId, parsed.data);
    } catch (error) {
        return mutationError(error, "No fue posible programar el movimiento.");
    }

    revalidateFinancialViews();
    
    return { success: true, message: "Movimiento programado." };
}

async function runOccurrenceAction(
    occurrenceId: string,
    operation: (userId: string, id: string) => Promise<void>,
    messages: { success: string; fallback: string },
): Promise<ActionResult> {
    const parsed = scheduledOccurrenceIdSchema.safeParse(occurrenceId);

    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
        };
    }

    const userId = await getAuthenticatedUserId();

    if (!userId) {
        return { success: false, message: "Tu sesión expiró." };
    }

    try {
        await operation(userId, parsed.data);
    } catch (error) {
        return mutationError(error, messages.fallback);
    }

    revalidateFinancialViews();

    return { success: true, message: messages.success };
}

export async function completeScheduledOccurrence(
    occurrenceId: string,
    allowInsufficientFunds = false,
): Promise<ActionResult> {
    const parsed = completeScheduledOccurrenceSchema.safeParse({
        occurrenceId,
        allowInsufficientFunds,
    });

    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
        };
    }

    const userId = await getAuthenticatedUserId();

    if (!userId) {
        return { success: false, message: "Tu sesión expiró." };
    }

    try {
        await completeUseCase.execute(userId, parsed.data.occurrenceId, {
            allowInsufficientFunds: parsed.data.allowInsufficientFunds,
        });
    } catch (error) {
        return mutationError(error, "No fue posible completar el movimiento.");
    }

    revalidateFinancialViews();

    return {
        success: true,
        message: "Movimiento completado y saldo actualizado.",
    };
}

export async function skipScheduledOccurrence(occurrenceId: string) {
    return runOccurrenceAction(occurrenceId, (userId, id) => skipUseCase.execute(userId, id),
        {
            success: "Movimiento omitido sin afectar el saldo.",
            fallback: "No fue posible omitir el movimiento.",
        },
    );
}

export async function cancelScheduledOccurrence(occurrenceId: string) {
    return runOccurrenceAction(occurrenceId, (userId, id) => cancelUseCase.execute(userId, id),
        {
            success: "Movimiento programado cancelado.",
            fallback: "No fue posible cancelar el movimiento.",
        },
    );
}

export async function rescheduleScheduledOccurrence(
    occurrenceId: string,
    scheduledAt: Date,
): Promise<ActionResult> {
    const parsed = rescheduleScheduledOccurrenceSchema.safeParse({ occurrenceId, scheduledAt });

    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
        };
    }

    return runOccurrenceAction(
        parsed.data.occurrenceId,
        (userId, id) => rescheduleUseCase.execute(userId, id, parsed.data.scheduledAt),
        {
            success: "Movimiento reagendado. Su fecha original queda registrada.",
            fallback: "No fue posible reagendar el movimiento.",
        },
    );
}
