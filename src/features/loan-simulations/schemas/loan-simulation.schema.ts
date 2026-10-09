import { z } from "zod";
import { downPaymentAmount } from "../domain/amortization-calculator";

const money = (label: string) => z.coerce.number({ error: `Ingresa ${label} válido.` })
    .finite(`Ingresa ${label} válido.`)
    .min(0, `${label[0].toUpperCase()}${label.slice(1)} no puede ser negativo.`);

export const loanTermsSchema = z.object({
    price: z.coerce.number({ error: "Ingresa un precio válido." }).finite().positive("El precio debe ser mayor que cero."),
    bonus: money("un bono"),
    accessories: money("un monto de accesorios"),
    downPaymentMode: z.enum(["percent", "amount"]),
    downPaymentValue: money("un enganche"),
    rateType: z.enum(["interest", "msi"]),
    annualRatePercent: z.coerce.number().finite().min(0, "La tasa no puede ser negativa.").max(200, "La tasa parece inválida."),
    rateIncludesVat: z.boolean(),
    vatPercent: z.coerce.number().finite().min(0).max(100),
    termMonths: z.coerce.number().int("El plazo debe ser un número entero de meses.").min(1, "El plazo mínimo es 1 mes.").max(120, "El plazo máximo es 120 meses."),
    firstDueDate: z.iso.date("Selecciona la fecha del primer pago."),
    shiftToBusinessDay: z.boolean(),
    openingFeeMode: z.enum(["none", "percent", "amount"]),
    openingFeeValue: money("una comisión"),
    openingFeeFinanced: z.boolean(),
    carInsuranceFirstYear: money("un seguro"),
    carInsuranceFinanced: z.boolean(),
    carInsuranceLaterAnnual: money("un seguro"),
    lifeInsuranceMode: z.enum(["none", "fixed", "balance"]),
    lifeInsuranceValue: money("un seguro de vida"),
});

export const loanSimulationSchema = loanTermsSchema.extend({
    name: z.string().trim().min(1, "Ingresa un nombre.").max(120),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
})
    .refine((data) => data.bonus < data.price, { path: ["bonus"], message: "El bono no puede ser mayor que el precio." })
    .refine((data) => data.downPaymentMode === "amount" || data.downPaymentValue <= 100, { path: ["downPaymentValue"], message: "El enganche no puede superar el 100%." })
    .refine((data) => downPaymentAmount(data) < data.price - data.bonus + data.accessories, { path: ["downPaymentValue"], message: "El enganche debe dejar un saldo por financiar." })
    .refine((data) => data.rateType === "msi" || data.annualRatePercent > 0, { path: ["annualRatePercent"], message: "Ingresa la tasa anual o elige meses sin intereses." });

export const loanSimulationIdSchema = z.uuid("La simulación no es válida.");

export type LoanTermsData = z.infer<typeof loanTermsSchema>;
export type LoanSimulationData = z.infer<typeof loanSimulationSchema>;
