import {
    categoryIconKeys, type CategoryIconKey, type CategoryType,
} from "../domain/category-repository";
import type { CategoryListItem } from "../queries/get-categories";
import type { CategoryFormData } from "../schemas/category.schema";

export function createCategoryDraft(type: CategoryType = "expense"): CategoryFormData {
    return {
        name: "",
        type,
        color: "#2563eb",
        icon: type === "expense" ? "shopping-cart" : "circle-dollar-sign",
    };
}

export function toCategoryDraft(category: CategoryListItem): CategoryFormData {
    const icon = categoryIconKeys.includes(category.icon as CategoryIconKey)
        ? category.icon as CategoryIconKey
        : "shapes";

    return {
        id: category.id,
        name: category.name,
        type: category.type === "income" ? "income" : "expense",
        color: category.color || "#2563eb",
        icon,
    };
}
