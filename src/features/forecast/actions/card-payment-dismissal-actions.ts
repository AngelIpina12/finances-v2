"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/src/db";
import { creditCardPaymentDismissals, financialAccounts } from "@/src/db/schema";
import { requireAuth } from "@/src/lib/auth-server";

const dismissalSchema = z.object({
    creditAccountId: z.uuid("La tarjeta no es válida."),
    dueAt: z.coerce.date("El vencimiento no es válido."),
});

export async function dismissCardPayment(input: z.input<typeof dismissalSchema>) {
    const parsed = dismissalSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };

    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };

    const [card] = await db
        .select({ id: financialAccounts.id })
        .from(financialAccounts)
        .where(and(
            eq(financialAccounts.id, parsed.data.creditAccountId),
            eq(financialAccounts.userId, session.user.id),
            eq(financialAccounts.type, "credit"),
            isNull(financialAccounts.deletedAt),
        ))
        .limit(1);

    if (!card) return { success: false, message: "No encontramos esa tarjeta." };

    await db.insert(creditCardPaymentDismissals).values({
        userId: session.user.id,
        creditAccountId: card.id,
        dueAt: parsed.data.dueAt,
    }).onConflictDoNothing();

    revalidatePath("/forecast");
    return { success: true, message: "Pago omitido de esta previsión." };
}

export async function restoreCardPayment(input: z.input<typeof dismissalSchema>) {
    const parsed = dismissalSchema.safeParse(input);
    if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };

    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };

    await db.delete(creditCardPaymentDismissals).where(and(
        eq(creditCardPaymentDismissals.userId, session.user.id),
        eq(creditCardPaymentDismissals.creditAccountId, parsed.data.creditAccountId),
        eq(creditCardPaymentDismissals.dueAt, parsed.data.dueAt),
    ));

    revalidatePath("/forecast");
    return { success: true, message: "Pago incluido nuevamente en la previsión." };
}
