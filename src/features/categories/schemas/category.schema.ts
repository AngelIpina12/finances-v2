import { z } from "zod";
import {
    categoryIconKeys, categoryTypes,
} from "../domain/category-repository";

export const categoryFormSchema = z.object({
    id: z.uuid().optional(),
    name: z
        .string()
        .trim()
        .min(2, "Escribe un nombre de al menos 2 caracteres.")
        .max(60, "El nombre no puede superar 60 caracteres."),
    type: z.enum(categoryTypes, {
        error: "Selecciona si corresponde a un gasto o ingreso.",
    }),
    color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/, "Selecciona un color válido."),
    icon: z.enum(categoryIconKeys, {
        error: "Selecciona un icono válido.",
    }),
});

export type CategoryFormData = z.infer<typeof categoryFormSchema>;
