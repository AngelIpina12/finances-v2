import { CategoryError } from "../category-error";
import type { CategoryRepository } from "../../domain/category-repository";

export class ArchiveCategoryUseCase {
    constructor(private readonly categories: CategoryRepository) {}

    async execute(userId: string, categoryId: string) {
        const archived = await this.categories.archive(userId, categoryId);

        if (!archived) {
            throw new CategoryError("No encontramos esa categoría.");
        }
    }
}
