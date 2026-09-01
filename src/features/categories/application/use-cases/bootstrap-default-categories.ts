import type { CategoryRecord, CategoryRepository } from "../../domain/category-repository";

export class BootstrapDefaultCategoriesUseCase {
    constructor(private readonly categories: CategoryRepository) { }

    async execute(userId: string, defaults: readonly CategoryRecord[]) {
        await this.categories.bootstrap(userId, defaults);
    }
}
