import { z } from "zod";

export const transferFormSchema = z
    .object({
        sourceAccountId: z.uuid("Selecciona una cuenta de origen válida."),
        destinationAccountId: z.uuid("Selecciona una cuenta de destino válida."),
        amount: z.coerce
            .number({ error: "Ingresa un monto válido." })
            .finite("Ingresa un monto válido.")
            .positive("El monto debe ser mayor que cero."),
        date: z.coerce.date({ error: "Selecciona una fecha válida." }),
        description: z
            .string()
            .trim()
            .max(120, "La descripción no puede superar 120 caracteres.")
            .optional()
            .or(z.literal("")),
        notes: z
            .string()
            .trim()
            .max(500, "Las notas no pueden superar 500 caracteres.")
            .optional()
            .or(z.literal("")),
    })
    .refine(
        (data) => data.sourceAccountId !== data.destinationAccountId,
        {
            message: "Elige una cuenta de destino diferente.",
            path: ["destinationAccountId"],
        },
    );

export type TransferFormData = z.infer<typeof transferFormSchema>;
