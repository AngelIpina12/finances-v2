"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/src/lib/auth-server";
import { ArchiveRecurringRuleUseCase } from "../application/use-cases/archive-recurring-rule";
import { CreateRecurringRuleUseCase } from "../application/use-cases/create-recurring-rule";
import { GenerateRecurringOccurrencesUseCase } from "../application/use-cases/generate-recurring-occurrences";
import { SetRecurringRuleActiveUseCase } from "../application/use-cases/set-recurring-rule-active";
import { UpdateRecurringRuleUseCase } from "../application/use-cases/update-recurring-rule";
import { RecurringRuleError } from "../application/recurring-rule-error";
import { DrizzleRecurringRuleRepository } from "../infrastructure/drizzle-recurring-rule-repository";
import {
    recurringRuleFormSchema, recurringRuleIdSchema, type RecurringRuleFormData,
} from "../schemas/recurring-rule.schema";

const repository = new DrizzleRecurringRuleRepository();
const createUseCase = new CreateRecurringRuleUseCase(repository);
const updateUseCase = new UpdateRecurringRuleUseCase(repository);
const pauseUseCase = new SetRecurringRuleActiveUseCase(repository, false);
const resumeUseCase = new SetRecurringRuleActiveUseCase(repository, true);
const archiveUseCase = new ArchiveRecurringRuleUseCase(repository);
const generateUseCase = new GenerateRecurringOccurrencesUseCase(repository);

type ActionResult = { success: boolean; message: string };

function revalidateFinancialViews() {
    revalidatePath("/scheduled");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
}

function mutationError(error: unknown, fallback: string): ActionResult {
    return {
        success: false,
        message: error instanceof RecurringRuleError ? error.message : fallback,
    };
}

async function authenticatedUserId() {
    const { session } = await requireAuth();
    return session?.user.id;
}

export async function saveRecurringRule(input: RecurringRuleFormData): Promise<ActionResult> {
    const parsed = recurringRuleFormSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const userId = await authenticatedUserId();

    if (!userId) return { success: false, message: "Tu sesión expiró." };

    try {
        if (parsed.data.id) {
            await updateUseCase.execute(userId, parsed.data.id, parsed.data);
        } else {
            await createUseCase.execute(userId, parsed.data);
        }
    } catch (error) {
        return mutationError(error, "No fue posible guardar la recurrencia.");
    }

    revalidateFinancialViews();
    return {
        success: true,
        message: parsed.data.id ? "Recurrencia actualizada." : "Recurrencia creada.",
    };
}

async function runRuleAction(
    ruleId: string,
    operation: (userId: string, id: string) => Promise<unknown>,
    messages: { success: string; fallback: string },
): Promise<ActionResult> {
    const parsed = recurringRuleIdSchema.safeParse(ruleId);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };

    const userId = await authenticatedUserId();
    if (!userId) return { success: false, message: "Tu sesión expiró." };

    try {
        await operation(userId, parsed.data);
    } catch (error) {
        return mutationError(error, messages.fallback);
    }

    revalidateFinancialViews();
    return { success: true, message: messages.success };
}

export async function pauseRecurringRule(ruleId: string) {
    return runRuleAction(ruleId, (userId, id) => pauseUseCase.execute(userId, id), {
        success: "Recurrencia pausada. Las ocurrencias ya creadas se conservaron.",
        fallback: "No fue posible pausar la recurrencia.",
    });
}

export async function resumeRecurringRule(ruleId: string) {
    return runRuleAction(ruleId, (userId, id) => resumeUseCase.execute(userId, id), {
        success: "Recurrencia reanudada y próximas fechas actualizadas.",
        fallback: "No fue posible reanudar la recurrencia.",
    });
}

export async function archiveRecurringRule(ruleId: string) {
    return runRuleAction(ruleId, (userId, id) => archiveUseCase.execute(userId, id), {
        success: "Recurrencia archivada. Sus ocurrencias permanecen en el historial.",
        fallback: "No fue posible archivar la recurrencia.",
    });
}

export async function generateRecurringOccurrences(ruleId?: string): Promise<ActionResult> {
    if (ruleId) {
        const parsed = recurringRuleIdSchema.safeParse(ruleId);
        if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const userId = await authenticatedUserId();
    if (!userId) return { success: false, message: "Tu sesión expiró." };

    try {
        const generated = await generateUseCase.execute(userId, ruleId);
        revalidateFinancialViews();
        return {
            success: true,
            message: generated
                ? `${generated} ocurrencia${generated === 1 ? "" : "s"} creada${generated === 1 ? "" : "s"}.`
                : "Las próximas ocurrencias ya estaban actualizadas.",
        };
    } catch (error) {
        return mutationError(error, "No fue posible generar las próximas ocurrencias.");
    }
}
