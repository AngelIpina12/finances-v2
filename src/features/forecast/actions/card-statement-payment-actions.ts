"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/src/lib/auth-server";
import { PayCardStatementUseCase } from "../application/use-cases/pay-card-statement";
import { ForecastError } from "../application/forecast-error";
import { InsufficientFundsError } from "@/src/features/transactions/domain/transaction-rules";
import { DrizzleCardStatementRepository } from "../infrastructure/drizzle-card-statement-repository";

const repository = new DrizzleCardStatementRepository();
const payCardStatementUseCase = new PayCardStatementUseCase(repository);

const paymentSchema = z.object({
    creditAccountId: z.uuid("La tarjeta no es válida."),
    sourceAccountId: z.uuid("La cuenta de pago no es válida."),
    allowInsufficientFunds: z.boolean().optional(),
});

function revalidateFinancialViews() {
    revalidatePath("/budgets");
    revalidatePath("/transactions");
    revalidatePath("/accounts");
    revalidatePath("/dashboard");
    revalidatePath("/forecast");
    revalidatePath("/financing");
}

export async function payCardStatement(input: z.input<typeof paymentSchema>) {
    const parsed = paymentSchema.safeParse(input);

    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
    }

    const { session } = await requireAuth();

    if (!session) {
        return { success: false, message: "Tu sesión expiró." };
    }

    try {
        const result = await payCardStatementUseCase.execute(session.user.id, parsed.data);

        revalidateFinancialViews();

        return {
            success: true,
            message: result.installmentsSettled > 0
                ? `Pago registrado. Se liquidaron ${result.installmentsSettled} cuota(s) de MSI junto con los cargos regulares.`
                : "Pago registrado.",
        };
    } catch (error) {
        if (error instanceof InsufficientFundsError) {
            return { success: false, message: error.message, insufficientFunds: error.kind };
        }

        return {
            success: false,
            message: error instanceof ForecastError ? error.message : "No fue posible registrar el pago.",
        };
    }
}
