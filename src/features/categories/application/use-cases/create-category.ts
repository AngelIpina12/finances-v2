import { CategoryError } from "../category-error";
import type { CategoryInput, CategoryRepository } from "../../domain/category-repository";

export class CreateCategoryUseCase {
    constructor(private readonly categories: CategoryRepository) { }

    async execute(userId: string, input: CategoryInput) {
        if (await this.categories.activeNameExists(userId, input.type, input.name)) {
            throw new CategoryError("Ya existe una categoría con ese nombre.");
        }

        const sortOrder = await this.categories.nextSortOrder(userId, input.type);
        await this.categories.create(userId, {
            ...input,
            sortOrder,
            isSystem: false,
        });
    }
}
