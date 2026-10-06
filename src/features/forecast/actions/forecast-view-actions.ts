"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/src/db";
import { forecastSavingsSimulations, forecastViews } from "@/src/db/schema";
import { requireAuth } from "@/src/lib/auth-server";
import { FORECAST_HORIZON_DAYS } from "../domain/forecast-horizon";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.");

const viewSchema = z.object({
    id: z.uuid("La previsión no es válida.").optional(),
    name: z.string().trim().min(1, "Ponle un nombre a la previsión.").max(80, "El nombre no puede superar 80 caracteres."),
    rangePresetDays: z.number().int().min(1).max(FORECAST_HORIZON_DAYS).nullable(),
    startsOn: dateSchema,
    endsOn: dateSchema,
    currency: z.string().min(1).max(8),
    accountKind: z.enum(["all", "debit", "credit"]),
    accountIds: z.array(z.uuid()).max(200),
    granularity: z.enum(["day", "week", "month"]),
    savingsMode: z.enum(["exclude", "principal", "with_yield"]),
    chartView: z.enum(["balance", "flows", "savings", "yields"]),
    savingsSimulationId: z.uuid().nullable(),
    isDefault: z.boolean(),
}).refine((view) => view.startsOn < view.endsOn, { message: "La fecha final debe ser posterior a la inicial." });

const viewIdSchema = z.uuid("La previsión no es válida.");

type ActionResult = { success: boolean; message: string; id?: string };

export async function saveForecastView(input: z.input<typeof viewSchema>): Promise<ActionResult> {
    const parsed = viewSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };

    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };
    const userId = session.user.id;
    const { id: viewId, ...data } = parsed.data;

    if (data.savingsSimulationId) {
        const [simulation] = await db
            .select({ id: forecastSavingsSimulations.id })
            .from(forecastSavingsSimulations)
            .where(and(
                eq(forecastSavingsSimulations.id, data.savingsSimulationId),
                eq(forecastSavingsSimulations.userId, userId),
            ))
            .limit(1);
        if (!simulation) return { success: false, message: "La simulación de ahorro ya no existe." };
    }

    const values = {
        ...data,
        startsOn: data.rangePresetDays === null ? data.startsOn : null,
        endsOn: data.rangePresetDays === null ? data.endsOn : null,
    };

    const id = await db.transaction(async (tx) => {
        if (data.isDefault) {
            await tx.update(forecastViews)
                .set({ isDefault: false })
                .where(and(
                    eq(forecastViews.userId, userId),
                    eq(forecastViews.isDefault, true),
                    ...(viewId ? [ne(forecastViews.id, viewId)] : []),
                ));
        }

        if (viewId) {
            const [updated] = await tx.update(forecastViews)
                .set(values)
                .where(and(eq(forecastViews.id, viewId), eq(forecastViews.userId, userId)))
                .returning({ id: forecastViews.id });
            return updated?.id;
        }

        const [created] = await tx.insert(forecastViews)
            .values({ ...values, userId })
            .returning({ id: forecastViews.id });
        return created.id;
    });
    if (!id) return { success: false, message: "Esa previsión ya no existe." };

    revalidatePath("/forecast");
    return { success: true, message: "Previsión guardada.", id };
}

export async function deleteForecastView(viewId: string): Promise<ActionResult> {
    const parsed = viewIdSchema.safeParse(viewId);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };

    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };

    await db.delete(forecastViews).where(and(
        eq(forecastViews.id, parsed.data),
        eq(forecastViews.userId, session.user.id),
    ));

    revalidatePath("/forecast");
    return { success: true, message: "Previsión eliminada." };
}
