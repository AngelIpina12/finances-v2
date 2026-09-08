"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/src/lib/auth-server";
import { AccountError } from "../application/account-error";
import { SaveCreditCardPaymentSettingsUseCase } from "../application/use-cases/save-credit-card-payment-settings";
import { DrizzleCreditCardPaymentSettingsRepository } from "../infrastructure/drizzle-credit-card-payment-settings-repository";
import {
    creditCardPaymentSettingsSchema, type CreditCardPaymentSettingsFormData,
} from "../schemas/credit-card-payment-settings.schema";

const saveSettings = new SaveCreditCardPaymentSettingsUseCase(
    new DrizzleCreditCardPaymentSettingsRepository(),
);

export async function saveCreditCardPaymentSettings(input: CreditCardPaymentSettingsFormData) {
    const parsed = creditCardPaymentSettingsSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };

    try {
        await saveSettings.execute(session.user.id, {
            ...parsed.data,
            fixedAmount: parsed.data.fixedAmount || undefined,
            statementBalance: parsed.data.statementBalance || undefined,
            minimumPayment: parsed.data.minimumPayment || undefined,
        });
    } catch (error) {
        if (!(error instanceof AccountError)) {
            console.error("[credit-card-payment-settings] Unexpected server action error", error);
        }

        return {
            success: false,
            message: error instanceof AccountError
                ? error.message
                : "No fue posible guardar el plan de pago.",
        };
    }

    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/forecast");
    return { success: true, message: "Plan de pago de la tarjeta actualizado." };
}
