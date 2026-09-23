import { z } from "zod";

const accountId = z.uuid("Selecciona una cuenta válida.");

export const fixedIncomePositionSchema = z.object({
    name: z.string().trim().min(1, "Ingresa un nombre.").max(120),
    institution: z.string().trim().max(120).optional().or(z.literal("")),
    fundingAccountId: accountId,
    settlementAccountId: accountId,
    principal: z.coerce.number().finite().positive("El capital debe ser mayor que cero."),
    annualRate: z.coerce.number().finite().min(0, "La tasa no puede ser negativa.").max(10, "La tasa parece inválida."),
    calculationMethod: z.enum(["simple", "compound"]),
    dayCountConvention: z.enum(["actual_360", "actual_365"]),
    interestFrequency: z.enum(["daily", "monthly", "at_maturity"]),
    withholdingRate: z.coerce.number().finite().min(0).max(1).optional(),
    startsAt: z.coerce.date(),
    maturesAt: z.coerce.date().optional(),
    isAvailableOnDemand: z.boolean().default(false),
    autoRenew: z.boolean().default(false),
}).refine((data) => !data.maturesAt || data.maturesAt > data.startsAt, { path: ["maturesAt"], message: "El vencimiento debe ser posterior al inicio." })
    .refine((data) => data.maturesAt || data.interestFrequency === "daily", { path: ["interestFrequency"], message: "Una cajita sin vencimiento debe reconocer rendimiento diario." })
    .refine((data) => !(data.calculationMethod === "compound" && data.interestFrequency === "daily"), { path: ["interestFrequency"], message: "El interés compuesto debe pagarse al vencimiento o mensualmente; el pago diario se deposita y deja de capitalizar." });

export const recordInterestSchema = z.object({
    positionId: z.uuid("La posición no es válida."),
    occurredAt: z.coerce.date(),
});

export const settlePositionSchema = z.object({
    positionId: z.uuid("La posición no es válida."),
    occurredAt: z.coerce.date(),
});

export type FixedIncomePositionData = z.infer<typeof fixedIncomePositionSchema>;
export type RecordInterestData = z.infer<typeof recordInterestSchema>;
export type SettlePositionData = z.infer<typeof settlePositionSchema>;
