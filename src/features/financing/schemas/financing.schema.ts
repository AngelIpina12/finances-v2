import { z } from "zod";

export const financingPlanFormSchema = z.object({
    purchaseTransactionId: z.uuid("Selecciona una compra válida."),
    name: z.string().trim().min(2, "Escribe un nombre de al menos 2 caracteres.")
        .max(120, "El nombre no puede superar 120 caracteres."),
    regularInstallmentCount: z.coerce.number().int("Ingresa un número entero.")
        .min(1, "Debe haber al menos una cuota.").max(240, "El máximo es 240 cuotas."),
    regularInstallmentAmount: z.coerce.number().finite("Ingresa un monto válido.")
        .positive("El monto debe ser mayor que cero."),
    balloonAmount: z.coerce.number().finite("Ingresa un monto válido.")
        .min(0, "El pago final no puede ser negativo.").default(0),
    startsAt: z.coerce.date({ error: "Selecciona la fecha del primer pago." }),
});

export const completeFinancingInstallmentSchema = z.object({
    installmentId: z.uuid("La cuota no es válida."),
    sourceAccountId: z.uuid("Selecciona una cuenta de origen válida."),
});

export type FinancingPlanFormData = z.infer<typeof financingPlanFormSchema>;
export type CompleteFinancingInstallmentData = z.infer<typeof completeFinancingInstallmentSchema>;
