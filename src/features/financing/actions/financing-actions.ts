"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/src/lib/auth-server";
import { CreateFinancingPlanUseCase } from "../application/use-cases/create-financing-plan";
import { CompleteFinancingInstallmentUseCase } from "../application/use-cases/complete-financing-installment";
import { FinancingError } from "../application/financing-error";
import { DrizzleFinancingRepository } from "../infrastructure/drizzle-financing-repository";
import {
    completeFinancingInstallmentSchema, financingPlanFormSchema, type CompleteFinancingInstallmentData,
    type FinancingPlanFormData,
} from "../schemas/financing.schema";

const repository = new DrizzleFinancingRepository();
const createPlan = new CreateFinancingPlanUseCase(repository);
const completeInstallment = new CompleteFinancingInstallmentUseCase(repository);

type ActionResult = { success: boolean; message: string };

function revalidateFinancialViews() {
    revalidatePath("/financing");
    revalidatePath("/scheduled");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
}

function errorResult(error: unknown, fallback: string): ActionResult {
    if (!(error instanceof FinancingError)) {
        console.error("[financing] Unexpected server action error", error);
    }

    return {
        success: false,
        message: error instanceof FinancingError ? error.message : fallback,
    };
}

async function userId() {
    const { session } = await requireAuth();
    return session?.user.id;
}

export async function createFinancingPlan(input: FinancingPlanFormData): Promise<ActionResult> {
    const parsed = financingPlanFormSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const authenticatedUserId = await userId();
    if (!authenticatedUserId) return { success: false, message: "Tu sesión expiró." };

    try {
        await createPlan.execute(authenticatedUserId, parsed.data);
    } catch (error) {
        return errorResult(error, "No fue posible crear el financiamiento.");
    }

    revalidateFinancialViews();
    return { success: true, message: "Financiamiento creado y cuotas programadas." };
}

export async function payFinancingInstallment(input: CompleteFinancingInstallmentData): Promise<ActionResult> {
    const parsed = completeFinancingInstallmentSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const authenticatedUserId = await userId();
    if (!authenticatedUserId) return { success: false, message: "Tu sesión expiró." };

    try {
        await completeInstallment.execute(
            authenticatedUserId,
            parsed.data.installmentId,
            parsed.data.sourceAccountId,
        );
    } catch (error) {
        return errorResult(error, "No fue posible registrar el pago de la cuota.");
    }

    revalidateFinancialViews();
    return { success: true, message: "Pago registrado y deuda de la tarjeta actualizada." };
}
