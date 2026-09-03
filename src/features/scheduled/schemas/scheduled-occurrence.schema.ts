import { z } from "zod";

export const scheduledTransactionTypes = ["income", "expense"] as const;

export const scheduledOccurrenceFormSchema = z.object({
    transactionType: z.enum(scheduledTransactionTypes, {
        error: "Selecciona si esperas un ingreso o un gasto.",
    }),
    accountId: z.uuid("Selecciona una cuenta válida."),
    categoryId: z.uuid("Selecciona una categoría válida."),
    name: z
        .string()
        .trim()
        .min(1, "Escribe un nombre para identificar el movimiento.")
        .max(120, "El nombre no puede superar 120 caracteres."),
    amount: z.coerce
        .number({ error: "Ingresa un monto válido." })
        .finite("Ingresa un monto válido.")
        .positive("El monto debe ser mayor que cero."),
    scheduledAt: z.coerce.date({
        error: "Selecciona una fecha y hora válidas.",
    }),
    notes: z
        .string()
        .trim()
        .max(500, "Las notas no pueden superar 500 caracteres.")
        .optional()
        .or(z.literal("")),
});

export const scheduledOccurrenceIdSchema = z.uuid("El movimiento programado no es válido.");
export const completeScheduledOccurrenceSchema = z.object({
    occurrenceId: scheduledOccurrenceIdSchema,
    allowCreditOverLimit: z.boolean(),
});
export type ScheduledOccurrenceFormData = z.infer<typeof scheduledOccurrenceFormSchema>;
