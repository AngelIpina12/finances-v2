"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/src/lib/auth-server";
import { CreateScheduledOccurrenceUseCase } from "../application/use-cases/create-scheduled-occurrence";
import { CompleteScheduledOccurrenceUseCase } from "../application/use-cases/complete-scheduled-occurrence";
import { TransitionScheduledOccurrenceUseCase } from "../application/use-cases/transition-scheduled-occurrence";
import { ScheduledOccurrenceError } from "../application/scheduled-occurrence-error";
import { DrizzleScheduledOccurrenceRepository } from "../infrastructure/drizzle-scheduled-occurrence-repository";
import {
    completeScheduledOccurrenceSchema, scheduledOccurrenceFormSchema,
    scheduledOccurrenceIdSchema, type ScheduledOccurrenceFormData,
} from "../schemas/scheduled-occurrence.schema";

const repository = new DrizzleScheduledOccurrenceRepository();
const createUseCase = new CreateScheduledOccurrenceUseCase(repository);
const completeUseCase = new CompleteScheduledOccurrenceUseCase(repository);
const skipUseCase = new TransitionScheduledOccurrenceUseCase(repository, "skipped");
const cancelUseCase = new TransitionScheduledOccurrenceUseCase(repository, "cancelled");

type ActionResult = {
    success: boolean;
    message: string;
};

function revalidateFinancialViews() {
    revalidatePath("/scheduled");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
}

function mutationError(error: unknown, fallback: string): ActionResult {
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
    allowCreditOverLimit = false,
): Promise<ActionResult> {
    const parsed = completeScheduledOccurrenceSchema.safeParse({
        occurrenceId,
        allowCreditOverLimit,
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
            allowCreditOverLimit: parsed.data.allowCreditOverLimit,
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
