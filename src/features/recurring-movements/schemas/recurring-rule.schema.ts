import { z } from "zod";

export const recurrenceFrequencies = [
    "weekly", "biweekly", "semimonthly", "monthly", "yearly", "custom",
] as const;
export const amountStrategies = ["fixed", "period_total", "custom_per_occurrence"] as const;
export const fifthOccurrencePolicies = [
    "keep_fixed", "distribute_monthly_total", "custom_amount",
] as const;

const optionalDate = z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.date({ error: "Selecciona una fecha válida." }).optional(),
);
const optionalNumber = z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().finite("Ingresa un monto válido.").positive("El monto debe ser mayor que cero.").optional(),
);
const optionalDay = z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().int("Selecciona un día válido.").min(0).max(31).optional(),
);
const calendarEntrySchema = z.object({
    scheduledAt: z.coerce.date({ error: "Selecciona una fecha válida." }),
    amount: optionalNumber,
});
const dateOverrideSchema = calendarEntrySchema.extend({
    originalScheduledAt: z.coerce.date({ error: "Selecciona la fecha original." }),
});

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
    amountStrategy: z.enum(amountStrategies).default("fixed"),
    fifthOccurrencePolicy: z.enum(fifthOccurrencePolicies).default("keep_fixed"),
    name: z.string().trim().min(1, "Escribe un nombre para identificar la recurrencia.")
        .max(120, "El nombre no puede superar 120 caracteres."),
    amount: z.coerce.number({ error: "Ingresa un monto válido." })
        .finite("Ingresa un monto válido.")
        .positive("El monto debe ser mayor que cero."),
    periodTotal: optionalNumber,
    fifthOccurrenceAmount: optionalNumber,
    semimonthlyFirstDay: optionalDay,
    semimonthlySecondDay: optionalDay,
    calendarEntries: z.array(calendarEntrySchema).default([]),
    dateOverrides: z.array(dateOverrideSchema).default([]),
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

    if (
        data.amountStrategy === "period_total"
        && !["weekly", "biweekly"].includes(data.frequency)
    ) {
        context.addIssue({
            code: "custom",
            path: ["amountStrategy"],
            message: "El total mensual sólo está disponible para pagos semanales o cada 14 días.",
        });
    }

    if (data.amountStrategy === "period_total" && !data.periodTotal) {
        context.addIssue({
            code: "custom",
            path: ["periodTotal"],
            message: "Ingresa el total mensual que quieres distribuir.",
        });
    }

    if (data.frequency === "semimonthly") {
        if (data.semimonthlyFirstDay === undefined || data.semimonthlySecondDay === undefined) {
            context.addIssue({
                code: "custom",
                path: ["semimonthlyFirstDay"],
                message: "Selecciona las dos fechas mensuales.",
            });
        } else if (data.semimonthlyFirstDay === data.semimonthlySecondDay) {
            context.addIssue({
                code: "custom",
                path: ["semimonthlySecondDay"],
                message: "Las dos fechas mensuales deben ser distintas.",
            });
        } else if (
            (data.semimonthlySecondDay === 0 && data.semimonthlyFirstDay >= 28)
            || (data.semimonthlyFirstDay >= 28 && data.semimonthlySecondDay >= 28)
        ) {
            context.addIssue({
                code: "custom",
                path: ["semimonthlySecondDay"],
                message: "Para evitar fechas duplicadas en febrero, combina el último día con un día del 1 al 27.",
            });
        }
    }

    if (data.frequency === "custom" && !data.calendarEntries.length) {
        context.addIssue({
            code: "custom",
            path: ["calendarEntries"],
            message: "Agrega al menos una fecha al calendario personalizado.",
        });
    }

    const customDates = new Set(data.calendarEntries.map((entry) => entry.scheduledAt.getTime()));
    if (customDates.size !== data.calendarEntries.length) {
        context.addIssue({
            code: "custom",
            path: ["calendarEntries"],
            message: "Cada fecha del calendario personalizado debe ser única.",
        });
    }

    if (data.fifthOccurrencePolicy === "custom_amount" && !data.fifthOccurrenceAmount) {
        context.addIssue({
            code: "custom",
            path: ["fifthOccurrenceAmount"],
            message: "Ingresa el monto para la quinta fecha del mes.",
        });
    }
});

export const recurringRuleIdSchema = z.uuid("La recurrencia no es válida.");
export type RecurringRuleFormData = z.infer<typeof recurringRuleFormSchema>;
