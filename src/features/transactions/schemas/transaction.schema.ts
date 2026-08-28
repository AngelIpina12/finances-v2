import { z } from "zod";

export const transactionFormSchema = z.object({
  type: z.enum(["income", "expense"]),
  accountId: z.string().uuid("Selecciona una cuenta válida."),
  categoryId: z.string().uuid("Selecciona una categoría válida."),
  amount: z.coerce
    .number()
    .positive("El monto debe ser mayor que cero.")
    .finite(),
  date: z.coerce.date(),
  merchant: z.string().trim().max(120).optional().or(z.literal("")),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
});

export type TransactionFormInput = z.infer<typeof transactionFormSchema>;
