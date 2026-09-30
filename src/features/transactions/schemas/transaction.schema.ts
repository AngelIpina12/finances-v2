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
    budgetAmount: z.preprocess(
        (value) => (value === "" || value === null ? undefined : value),
        z.coerce.number().finite("Ingresa un monto válido.")
            .min(0, "El monto no puede ser negativo.")
            .optional(),
    ),
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
    allowInsufficientFunds: z.boolean().optional(),
}).superRefine((data, context) => {
    if (data.budgetAmount !== undefined && data.budgetAmount > data.amount) {
        context.addIssue({
            code: "custom",
            path: ["budgetAmount"],
            message: "El importe para presupuesto no puede superar el monto del movimiento.",
        });
    }
});

export type TransactionFormData = z.infer<typeof transactionFormSchema>;

export const transactionIdSchema = z.uuid("El movimiento no es válido.");
