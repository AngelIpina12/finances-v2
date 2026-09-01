import { CategoryError } from "../category-error";
import type { CategoryInput, CategoryRepository } from "../../domain/category-repository";

export class UpdateCategoryUseCase {
    constructor(private readonly categories: CategoryRepository) { }

    async execute(userId: string, categoryId: string, input: CategoryInput) {
        const current = await this.categories.findActive(userId, categoryId);

        if (!current) {
            throw new CategoryError("No encontramos esa categoría.");
        }

        if (
            current.type !== input.type
            && await this.categories.hasTransactions(userId, categoryId)
        ) {
            throw new CategoryError(
                "No puedes cambiar el tipo de una categoría que ya tiene movimientos.",
            );
        }

        if (
            await this.categories.activeNameExists(
                userId,
                input.type,
                input.name,
                categoryId,
            )
        ) {
            throw new CategoryError("Ya existe una categoría con ese nombre.");
        }

        const updated = await this.categories.update(userId, categoryId, input);

        if (!updated) throw new CategoryError("No encontramos esa categoría.");
    }
}
