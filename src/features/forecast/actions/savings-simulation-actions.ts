"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/src/db";
import { financialAccounts, fixedIncomePositions, forecastSavingsSimulations } from "@/src/db/schema";
import { requireAuth } from "@/src/lib/auth-server";

const simulationSchema = z.object({
    id: z.uuid("La simulación no es válida.").optional(),
    name: z.string().trim().min(1, "Ponle un nombre a la simulación.").max(80, "El nombre no puede superar 80 caracteres."),
    rules: z.array(z.object({
        accountId: z.uuid("Selecciona una cuenta válida."),
        positionId: z.uuid("Selecciona una cajita válida."),
        minimumBalance: z.coerce.number().finite("Ingresa un saldo mínimo válido.").min(0, "El saldo mínimo no puede ser negativo."),
    }))
        .min(1, "Agrega al menos una cuenta a la simulación.")
        .max(20, "La simulación admite hasta 20 cuentas.")
        .refine((rules) => new Set(rules.map((rule) => rule.accountId)).size === rules.length, "Cada cuenta sólo puede aparecer una vez.")
        .refine((rules) => new Set(rules.map((rule) => rule.positionId)).size === rules.length, "Cada cajita sólo puede usarse en una cuenta."),
    isDefault: z.boolean(),
});

const simulationIdSchema = z.uuid("La simulación no es válida.");

type ActionResult = { success: boolean; message: string; id?: string };

export async function saveSavingsSimulation(input: z.input<typeof simulationSchema>): Promise<ActionResult> {
    const parsed = simulationSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };

    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };
    const userId = session.user.id;
    const data = parsed.data;

    // Cada cajita debe pertenecer a su cuenta: sus retiros regresan a ella.
    const positions = await db
        .select({ id: fixedIncomePositions.id, fundingAccountId: fixedIncomePositions.fundingAccountId })
        .from(fixedIncomePositions)
        .innerJoin(financialAccounts, eq(financialAccounts.id, fixedIncomePositions.fundingAccountId))
        .where(and(
            inArray(fixedIncomePositions.id, data.rules.map((rule) => rule.positionId)),
            eq(fixedIncomePositions.userId, userId),
            eq(fixedIncomePositions.status, "active"),
            eq(fixedIncomePositions.isAvailableOnDemand, true),
            eq(fixedIncomePositions.interestFrequency, "daily"),
            eq(financialAccounts.userId, userId),
            isNull(financialAccounts.deletedAt),
        ));
    const isLinked = (rule: (typeof data.rules)[number]) => positions.some((position) => (
        position.id === rule.positionId && position.fundingAccountId === rule.accountId
    ));
    if (!data.rules.every(isLinked)) {
        return { success: false, message: "Cada cuenta debe usar una cajita con rendimiento diario ligada a ella." };
    }

    const values = {
        name: data.name,
        rules: data.rules,
        isDefault: data.isDefault,
    };

    const id = await db.transaction(async (tx) => {
        if (data.isDefault) {
            await tx.update(forecastSavingsSimulations)
                .set({ isDefault: false })
                .where(and(
                    eq(forecastSavingsSimulations.userId, userId),
                    eq(forecastSavingsSimulations.isDefault, true),
                    ...(data.id ? [ne(forecastSavingsSimulations.id, data.id)] : []),
                ));
        }

        if (data.id) {
            const [updated] = await tx.update(forecastSavingsSimulations)
                .set(values)
                .where(and(
                    eq(forecastSavingsSimulations.id, data.id),
                    eq(forecastSavingsSimulations.userId, userId),
                ))
                .returning({ id: forecastSavingsSimulations.id });
            return updated?.id;
        }

        const [created] = await tx.insert(forecastSavingsSimulations)
            .values({ ...values, userId })
            .returning({ id: forecastSavingsSimulations.id });
        return created.id;
    });
    if (!id) return { success: false, message: "Esa simulación ya no existe." };

    revalidatePath("/forecast");
    return { success: true, message: "Simulación guardada.", id };
}

export async function deleteSavingsSimulation(simulationId: string): Promise<ActionResult> {
    const parsed = simulationIdSchema.safeParse(simulationId);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };

    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };

    await db.delete(forecastSavingsSimulations).where(and(
        eq(forecastSavingsSimulations.id, parsed.data),
        eq(forecastSavingsSimulations.userId, session.user.id),
    ));

    revalidatePath("/forecast");
    return { success: true, message: "Simulación eliminada." };
}
