"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/src/lib/auth-server";
import { FixedIncomeError } from "../application/fixed-income-error";
import { DrizzleFixedIncomeRepository } from "../infrastructure/drizzle-fixed-income-repository";
import {
    addCapitalSchema, fixedIncomePositionSchema, recordInterestSchema,
    settlePositionSchema, withdrawCapitalSchema, type AddCapitalData,
    type FixedIncomePositionData, type RecordInterestData, type SettlePositionData,
    type WithdrawCapitalData
} from "../schemas/fixed-income.schema";

const repository = new DrizzleFixedIncomeRepository();
type ActionResult = { success: boolean; message: string };

function revalidateViews() {
    ["/fixed-income", "/accounts", "/transactions", "/dashboard", "/forecast"].forEach((path) => revalidatePath(path));
}

async function authenticatedUser() {
    const { session } = await requireAuth();
    return session?.user.id;
}

function errorResult(error: unknown, fallback: string): ActionResult {
    if (!(error instanceof FixedIncomeError)) console.error("[fixed-income] Unexpected error", error);
    return { success: false, message: error instanceof FixedIncomeError ? error.message : fallback };
}

export async function createFixedIncomePosition(input: FixedIncomePositionData): Promise<ActionResult> {
    const parsed = fixedIncomePositionSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const userId = await authenticatedUser();
    if (!userId) return { success: false, message: "Tu sesión expiró." };
    try { await repository.create(userId, parsed.data); } catch (error) { return errorResult(error, "No fue posible crear la inversión."); }
    revalidateViews();
    return { success: true, message: "Inversión creada y capital transferido sin registrarlo como gasto." };
}

export async function updateFixedIncomePosition(
    positionId: string,
    input: FixedIncomePositionData,
): Promise<ActionResult> {
    const parsedId = settlePositionSchema.shape.positionId.safeParse(positionId);
    const parsed = fixedIncomePositionSchema.safeParse(input);
    if (!parsedId.success || !parsed.success) {
        return { success: false, message: parsedId.error?.issues[0]?.message ?? parsed.error?.issues[0]?.message ?? "Datos inválidos." };
    }
    const userId = await authenticatedUser();
    if (!userId) return { success: false, message: "Tu sesión expiró." };
    try { await repository.update(userId, parsedId.data, parsed.data); } catch (error) { return errorResult(error, "No fue posible actualizar la inversión."); }
    revalidateViews();
    return { success: true, message: "Cajita actualizada." };
}

export async function recordDailyFixedIncomeInterest(input: RecordInterestData): Promise<ActionResult> {
    const parsed = recordInterestSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const userId = await authenticatedUser();
    if (!userId) return { success: false, message: "Tu sesión expiró." };
    try {
        const result = await repository.recordDailyInterest(userId, parsed.data.positionId, parsed.data.occurredAt);
        revalidateViews();
        return { success: true, message: `Rendimiento neto de ${result.net.toFixed(2)} agregado a tu cajita.` };
    } catch (error) { return errorResult(error, "No fue posible registrar el rendimiento."); }
}

export async function withdrawFixedIncomeCapital(input: WithdrawCapitalData): Promise<ActionResult> {
    const parsed = withdrawCapitalSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const userId = await authenticatedUser();
    if (!userId) return { success: false, message: "Tu sesión expiró." };
    try { await repository.withdraw(userId, parsed.data.positionId, parsed.data.amount, parsed.data.occurredAt); } catch (error) { return errorResult(error, "No fue posible retirar el capital."); }
    revalidateViews();
    return { success: true, message: "Capital retirado a tu cuenta de débito." };
}

export async function addFixedIncomeCapital(input: AddCapitalData): Promise<ActionResult> {
    const parsed = addCapitalSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const userId = await authenticatedUser();
    if (!userId) return { success: false, message: "Tu sesión expiró." };
    try { await repository.addCapital(userId, parsed.data.positionId, parsed.data.amount, parsed.data.occurredAt); } catch (error) { return errorResult(error, "No fue posible aportar el capital."); }
    revalidateViews();
    return { success: true, message: "Capital aportado a tu cajita." };
}

export async function settleFixedIncomePosition(input: SettlePositionData): Promise<ActionResult> {
    const parsed = settlePositionSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const userId = await authenticatedUser();
    if (!userId) return { success: false, message: "Tu sesión expiró." };
    try { await repository.settle(userId, parsed.data.positionId, parsed.data.occurredAt); } catch (error) { return errorResult(error, "No fue posible liquidar la inversión."); }
    revalidateViews();
    return { success: true, message: "Capital e interés pendiente registrados correctamente en tu cuenta líquida." };
}

export async function cancelFixedIncomePosition(input: SettlePositionData): Promise<ActionResult> {
    const parsed = settlePositionSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    const userId = await authenticatedUser();
    if (!userId) return { success: false, message: "Tu sesión expiró." };
    try { await repository.cancel(userId, parsed.data.positionId, parsed.data.occurredAt); } catch (error) { return errorResult(error, "No fue posible cancelar la cajita."); }
    revalidateViews();
    return { success: true, message: "Cajita cancelada y capital devuelto a tu cuenta." };
}
