"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/src/lib/auth-server";
import { BudgetError } from "../application/budget-error";
import { ArchiveBudgetUseCase } from "../application/use-cases/archive-budget";
import { SaveBudgetUseCase } from "../application/use-cases/save-budget";
import { DrizzleBudgetRepository } from "../infrastructure/drizzle-budget-repository";
import { budgetFormSchema, type BudgetFormData } from "../schemas/budget.schema";

const repository = new DrizzleBudgetRepository();
const saveBudgetUseCase = new SaveBudgetUseCase(repository);
const archiveBudgetUseCase = new ArchiveBudgetUseCase(repository);

function revalidateBudgetConsumers() {
    ["/budgets", "/dashboard", "/transactions"].forEach((path) => revalidatePath(path));
}

export async function saveBudget(input: BudgetFormData) {
    const parsed = budgetFormSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };

    try {
        await saveBudgetUseCase.execute(session.user.id, parsed.data);
    } catch (error) {
        if (!(error instanceof BudgetError)) {
            console.error("No fue posible guardar el presupuesto.", error);
        }

        return {
            success: false,
            message: error instanceof BudgetError ? error.message : "No fue posible guardar el presupuesto.",
        };
    }

    revalidateBudgetConsumers();
    return {
        success: true,
        message: parsed.data.id ? "Presupuesto actualizado." : "Presupuesto creado.",
    };
}

export async function archiveBudget(id: string) {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { success: false, message: "Presupuesto inválido." };

    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };

    try {
        await archiveBudgetUseCase.execute(session.user.id, parsed.data);
    } catch (error) {
        return {
            success: false,
            message: error instanceof BudgetError ? error.message : "No fue posible archivar el presupuesto.",
        };
    }

    revalidateBudgetConsumers();
    return { success: true, message: "Presupuesto archivado." };
}
