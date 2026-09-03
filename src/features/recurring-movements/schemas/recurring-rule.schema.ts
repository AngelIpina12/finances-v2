import { z } from "zod";

export const recurrenceFrequencies = ["weekly", "biweekly", "monthly", "yearly"] as const;

const optionalDate = z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.date({ error: "Selecciona una fecha válida." }).optional(),
);

export const recurringRuleFormSchema = z.object({
    id: z.uuid("La recurrencia no es válida.").optional(),
    transactionType: z.enum(["income", "expense"], {
        error: "Selecciona si es un ingreso o un gasto.",
    }),
    accountId: z.uuid("Selecciona una cuenta válida."),
    categoryId: z.uuid("Selecciona una categoría válida."),
    frequency: z.enum(recurrenceFrequencies, {
        error: "Selecciona una frecuencia válida.",
    }),
    name: z.string().trim().min(1, "Escribe un nombre para identificar la recurrencia.")
        .max(120, "El nombre no puede superar 120 caracteres."),
    amount: z.coerce.number({ error: "Ingresa un monto válido." })
        .finite("Ingresa un monto válido.")
        .positive("El monto debe ser mayor que cero."),
    startsAt: z.coerce.date({ error: "Selecciona una fecha y hora válidas." }),
    endsAt: optionalDate,
    notes: z.string().trim().max(500, "Las notas no pueden superar 500 caracteres.")
        .optional().or(z.literal("")),
}).superRefine((data, context) => {
    if (data.endsAt && data.endsAt < data.startsAt) {
        context.addIssue({
            code: "custom",
            path: ["endsAt"],
            message: "La fecha final debe ser posterior al inicio.",
        });
    }
});

export const recurringRuleIdSchema = z.uuid("La recurrencia no es válida.");
export type RecurringRuleFormData = z.infer<typeof recurringRuleFormSchema>;
