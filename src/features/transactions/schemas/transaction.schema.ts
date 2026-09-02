import { z } from "zod";

export const transactionTypes = ["income", "expense"] as const;

export const transactionFormSchema = z.object({
    id: z.uuid("El movimiento no es válido.").optional(),
    type: z.enum(transactionTypes, {
        error: "Selecciona si es un ingreso o un gasto.",
    }),
    accountId: z.uuid("Selecciona una cuenta válida."),
    categoryId: z.uuid("Selecciona una categoría válida."),
    amount: z.coerce
        .number({ error: "Ingresa un monto válido." })
        .finite("Ingresa un monto válido.")
        .positive("El monto debe ser mayor que cero."),
    date: z.coerce.date({ error: "Selecciona una fecha válida." }),
    merchant: z
        .string()
        .trim()
        .max(120, "El comercio o descripción no puede superar 120 caracteres.")
        .optional()
        .or(z.literal("")),
    notes: z
        .string()
        .trim()
        .max(500, "Las notas no pueden superar 500 caracteres.")
        .optional()
        .or(z.literal("")),
});

export type TransactionFormData = z.infer<typeof transactionFormSchema>;

export const transactionIdSchema = z.uuid("El movimiento no es válido.");
