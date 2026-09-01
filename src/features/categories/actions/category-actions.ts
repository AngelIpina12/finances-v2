"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/src/lib/auth-server";
import { CategoryError } from "../application/category-error";
import { ArchiveCategoryUseCase } from "../application/use-cases/archive-category";
import { BootstrapDefaultCategoriesUseCase } from "../application/use-cases/bootstrap-default-categories";
import { CreateCategoryUseCase } from "../application/use-cases/create-category";
import { UpdateCategoryUseCase } from "../application/use-cases/update-category";
import { defaultCategories } from "../constants/category.constants";
import { DrizzleCategoryRepository } from "../infrastructure/drizzle-category-repository";
import { categoryFormSchema, type CategoryFormData } from "../schemas/category.schema";

const repository = new DrizzleCategoryRepository();
const createCategoryUseCase = new CreateCategoryUseCase(repository);
const updateCategoryUseCase = new UpdateCategoryUseCase(repository);
const archiveCategoryUseCase = new ArchiveCategoryUseCase(repository);
const bootstrapCategoriesUseCase = new BootstrapDefaultCategoriesUseCase(repository);

function revalidateCategoryConsumers() {
    revalidatePath("/categories");
    revalidatePath("/transactions");
    revalidatePath("/dashboard");
}

export async function saveCategory(input: CategoryFormData) {
    const parsed = categoryFormSchema.safeParse(input);

    if (!parsed.success) {
        return {
            success: false,
            message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
        };
    }

    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };

    try {
        if (parsed.data.id) {
            await updateCategoryUseCase.execute(
                session.user.id,
                parsed.data.id,
                parsed.data,
            );
        } else {
            await createCategoryUseCase.execute(session.user.id, parsed.data);
        }
    } catch (error) {
        if (!(error instanceof CategoryError)) {
            console.error("No fue posible guardar la categoría.", error);
        }

        return {
            success: false,
            message: error instanceof CategoryError
                ? error.message
                : "No fue posible guardar la categoría.",
        };
    }

    revalidateCategoryConsumers();
    return {
        success: true,
        message: parsed.data.id ? "Categoría actualizada." : "Categoría creada.",
    };
}

export async function archiveCategory(categoryId: string) {
    const parsedId = z.uuid().safeParse(categoryId);
    if (!parsedId.success) return { success: false, message: "Categoría inválida." };

    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };

    try {
        await archiveCategoryUseCase.execute(session.user.id, parsedId.data);
    } catch (error) {
        return {
            success: false,
            message: error instanceof CategoryError
                ? error.message
                : "No fue posible archivar la categoría.",
        };
    }

    revalidateCategoryConsumers();
    return { success: true, message: "Categoría archivada." };
}

export async function bootstrapDefaultCategories() {
    const { session } = await requireAuth();
    if (!session) return { success: false, message: "Tu sesión expiró." };

    try {
        await bootstrapCategoriesUseCase.execute(session.user.id, defaultCategories);
    } catch (error) {
        console.error("No fue posible preparar las categorías.", error);
        return {
            success: false,
            message: "No fue posible preparar las categorías.",
        };
    }

    revalidateCategoryConsumers();
    return { success: true, message: "Tus categorías iniciales están listas." };
}
