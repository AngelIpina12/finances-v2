import { z } from "zod";

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().min(0).optional(),
);

export const accountTypes = [
  "cash",
  "debit",
  "credit",
  "wallet",
  "investment",
  "fixed_income",
  "loan",
] as const;

export const currencies = ["MXN", "USD", "EUR", "GBP"] as const;

export const accountColors = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#059669",
  "#0f172a",
] as const;

export const accountColorLabels: Record<
  (typeof accountColors)[number],
  string
> = {
  "#2563eb": "Azul océano",
  "#7c3aed": "Violeta nocturno",
  "#db2777": "Frambuesa",
  "#ea580c": "Ámbar cálido",
  "#059669": "Verde esmeralda",
  "#0f172a": "Grafito",
};

export function getAccountColorLabel(color: string) {
  return accountColorLabels[color as keyof typeof accountColorLabels] ?? "Color personalizado";
}

export const financialAccountSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z
      .string()
      .trim()
      .min(2, "Escribe un nombre de al menos 2 caracteres.")
      .max(80),
    type: z.enum(accountTypes),
    currency: z.enum(currencies),
    institution: z.string().trim().max(80).optional().or(z.literal("")),
    openingBalance: z.coerce.number().finite("Ingresa un saldo válido."),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Selecciona un color válido."),
    lastFourDigits: z
      .string()
      .regex(/^\d{4}$/, "Ingresa exactamente 4 dígitos.")
      .optional()
      .or(z.literal("")),
    includeInNetWorth: z.boolean().default(true),
    creditLimit: optionalNumber,
    owedAmount: optionalNumber,
    availableCredit: optionalNumber,
    billingDate: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().int().min(1).max(31).optional(),
    ),
    dueDate: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.coerce.number().int().min(1).max(31).optional(),
    ),
  })
  .superRefine((data, context) => {
    if (data.type === "credit" && !data.creditLimit) {
      context.addIssue({
        code: "custom",
        path: ["creditLimit"],
        message: "El límite de crédito es obligatorio.",
      });
    }

    if (data.type === "credit" && data.owedAmount === undefined) {
      context.addIssue({
        code: "custom",
        path: ["owedAmount"],
        message: "La deuda actual es obligatoria.",
      });
    }

    if (
      data.type === "credit" &&
      data.creditLimit !== undefined &&
      data.owedAmount !== undefined &&
      data.owedAmount > data.creditLimit
    ) {
      context.addIssue({
        code: "custom",
        path: ["owedAmount"],
        message: "La deuda no puede superar el límite de crédito.",
      });
    }
  });

export type FinancialAccountInput = z.infer<typeof financialAccountSchema>;
