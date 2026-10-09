"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/src/lib/auth-server";
import { LoanSimulationError } from "../application/loan-simulation-error";
import { DrizzleLoanSimulationRepository } from "../infrastructure/drizzle-loan-simulation-repository";
import {
    loanSimulationIdSchema, loanSimulationSchema, type LoanSimulationData,
} from "../schemas/loan-simulation.schema";

const repository = new DrizzleLoanSimulationRepository();
type ActionResult = { success: boolean; message: string; id?: string };

async function authenticatedUser() {
    const { session } = await requireAuth();
    return session?.user.id;
}

function errorResult(error: unknown, fallback: string): ActionResult {
    if (!(error instanceof LoanSimulationError)) console.error("[loan-simulations] Unexpected error", error);
    return { success: false, message: error instanceof LoanSimulationError ? error.message : fallback };
}

export async function createLoanSimulation(input: LoanSimulationData): Promise<ActionResult> {
    const parsed = loanSimulationSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const userId = await authenticatedUser();
    if (!userId) return { success: false, message: "Tu sesión expiró." };
    try {
        const id = await repository.create(userId, parsed.data);
        revalidatePath("/loan-simulator");
        return { success: true, message: "Simulación guardada.", id };
    } catch (error) { return errorResult(error, "No fue posible guardar la simulación."); }
}

export async function updateLoanSimulation(simulationId: string, input: LoanSimulationData): Promise<ActionResult> {
    const parsedId = loanSimulationIdSchema.safeParse(simulationId);
    const parsed = loanSimulationSchema.safeParse(input);
    if (!parsedId.success || !parsed.success) {
        return { success: false, message: parsedId.error?.issues[0]?.message ?? parsed.error?.issues[0]?.message ?? "Datos inválidos." };
    }
    const userId = await authenticatedUser();
    if (!userId) return { success: false, message: "Tu sesión expiró." };
    try { await repository.update(userId, parsedId.data, parsed.data); } catch (error) { return errorResult(error, "No fue posible actualizar la simulación."); }
    revalidatePath("/loan-simulator");
    return { success: true, message: "Simulación actualizada.", id: parsedId.data };
}

export async function deleteLoanSimulation(simulationId: string): Promise<ActionResult> {
    const parsedId = loanSimulationIdSchema.safeParse(simulationId);
    if (!parsedId.success) return { success: false, message: parsedId.error.issues[0]?.message ?? "Datos inválidos." };
    const userId = await authenticatedUser();
    if (!userId) return { success: false, message: "Tu sesión expiró." };
    try { await repository.delete(userId, parsedId.data); } catch (error) { return errorResult(error, "No fue posible eliminar la simulación."); }
    revalidatePath("/loan-simulator");
    return { success: true, message: "Simulación eliminada." };
}
