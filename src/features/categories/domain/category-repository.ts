export const categoryTypes = ["expense", "income"] as const;
export type CategoryType = (typeof categoryTypes)[number];

export const categoryIconKeys = [
    "shopping-cart",
    "house",
    "car",
    "heart-pulse",
    "gamepad-2",
    "graduation-cap",
    "briefcase-business",
    "circle-dollar-sign",
    "chart-no-axes-combined",
    "shapes",
] as const;
export type CategoryIconKey = (typeof categoryIconKeys)[number];

export type CategoryInput = {
    name: string;
    type: CategoryType;
    color: string;
    icon: CategoryIconKey;
};

export type CategoryRecord = CategoryInput & {
    sortOrder: number;
    isSystem: boolean;
};

export interface CategoryRepository {
    findActive(
        userId: string,
        categoryId: string,
    ): Promise<{ type: CategoryType } | undefined>;
    hasTransactions(userId: string, categoryId: string): Promise<boolean>;
    activeNameExists(
        userId: string,
        type: CategoryType,
        name: string,
        excludeId?: string,
    ): Promise<boolean>;
    nextSortOrder(userId: string, type: CategoryType): Promise<number>;
    create(userId: string, category: CategoryRecord): Promise<void>;
    update(
        userId: string,
        categoryId: string,
        category: CategoryInput,
    ): Promise<boolean>;
    archive(userId: string, categoryId: string): Promise<boolean>;
    bootstrap(userId: string, categories: readonly CategoryRecord[]): Promise<void>;
}
