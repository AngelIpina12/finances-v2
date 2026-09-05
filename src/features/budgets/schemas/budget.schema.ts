import { z } from "zod";

const allocationSchema = z.object({
    categoryId: z.uuid("Selecciona una categoría válida."),
    amount: z.coerce.number().positive("La asignación debe ser mayor que cero."),
});

export const budgetFormSchema = z.object({
    id: z.uuid().optional(),
    name: z.string().trim().min(2, "Escribe un nombre de al menos 2 caracteres.").max(120),
    amount: z.coerce.number().positive("El límite debe ser mayor que cero."),
    currency: z.enum(["MXN", "USD", "EUR", "GBP"]),
    period: z.enum(["weekly", "monthly", "quarterly", "yearly", "custom"]),
    rollover: z.enum(["disabled", "carry_remaining", "carry_deficit"]),
    isReusable: z.boolean(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Selecciona un color válido."),
    warningThreshold: z.coerce.number().int().min(1).max(100),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().optional(),
    allocations: z.array(allocationSchema).default([]),
}).superRefine((value, context) => {
    if (value.period === "custom" && !value.endsAt) {
        context.addIssue({ code: "custom", path: ["endsAt"], message: "Define la fecha de finalización." });
    }

    if (value.endsAt && value.endsAt <= value.startsAt) {
        context.addIssue({ code: "custom", path: ["endsAt"], message: "Debe ser posterior al inicio." });
    }

    const ids = new Set(value.allocations.map((allocation) => allocation.categoryId));
    if (ids.size !== value.allocations.length) {
        context.addIssue({ code: "custom", path: ["allocations"], message: "No repitas categorías." });
    }

    const allocated = value.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    if (allocated > value.amount + 0.00001) {
        context.addIssue({ code: "custom", path: ["allocations"], message: "Las asignaciones no pueden superar el límite." });
    }
});

export type BudgetFormData = z.infer<typeof budgetFormSchema>;
