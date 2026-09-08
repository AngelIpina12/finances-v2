import { z } from "zod";

const optionalAmount = z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce
        .number({ error: "Ingresa un monto válido." })
        .finite("Ingresa un monto válido.")
        .min(0, "El monto no puede ser negativo.")
        .optional(),
);

export const creditCardPaymentSettingsSchema = z.object({
    creditAccountId: z.uuid("Selecciona una tarjeta válida."),
    sourceAccountId: z.uuid("Selecciona una cuenta de pago válida."),
    strategy: z.enum(["full_statement", "minimum_payment", "fixed_amount", "manual"]),
    fixedAmount: optionalAmount,
    paymentTermDays: z.coerce
        .number({ error: "Ingresa una cantidad válida de días naturales." })
        .int("Ingresa días naturales completos, sin decimales.")
        .min(1, "El plazo debe ser de al menos 1 día natural.")
        .max(90, "El plazo no puede ser mayor que 90 días naturales."),
    includeInForecast: z.boolean().default(true),
    billingDate: z.coerce
        .number({ error: "Selecciona un día de corte válido." })
        .int("Selecciona un día de corte completo.")
        .min(1, "El día de corte debe estar entre 1 y 31.")
        .max(31, "El día de corte debe estar entre 1 y 31."),
    statementBalance: optionalAmount,
    minimumPayment: optionalAmount,
}).superRefine((data, context) => {
    if (data.strategy === "fixed_amount" && (!data.fixedAmount || data.fixedAmount <= 0)) {
        context.addIssue({
            code: "custom",
            path: ["fixedAmount"],
            message: "Indica un monto fijo mayor que cero.",
        });
    }
});

export type CreditCardPaymentSettingsFormData = z.infer<typeof creditCardPaymentSettingsSchema>;
