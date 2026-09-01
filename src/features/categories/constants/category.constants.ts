import type {
    CategoryIconKey, CategoryRecord, CategoryType,
} from "../domain/category-repository";

export const CATEGORY_TYPE_LABELS: Record<CategoryType, string> = {
    expense: "Gasto",
    income: "Ingreso",
};

export const CATEGORY_ICON_LABELS: Record<CategoryIconKey, string> = {
    "shopping-cart": "Carrito",
    house: "Casa",
    car: "Transporte",
    "heart-pulse": "Salud",
    "gamepad-2": "Entretenimiento",
    "graduation-cap": "Educación",
    "briefcase-business": "Trabajo",
    "circle-dollar-sign": "Dinero",
    "chart-no-axes-combined": "Inversiones",
    shapes: "Otros",
};

export const categoryColors = [
    "#2563eb",
    "#7c3aed",
    "#db2777",
    "#ea580c",
    "#059669",
    "#eab308",
    "#06b6d4",
    "#64748b",
] as const;

export const defaultCategories = [
    { name: "Nómina", type: "income", color: "#059669", icon: "briefcase-business", sortOrder: 10, isSystem: true },
    { name: "Freelance", type: "income", color: "#2563eb", icon: "circle-dollar-sign", sortOrder: 20, isSystem: true },
    { name: "Inversiones", type: "income", color: "#7c3aed", icon: "chart-no-axes-combined", sortOrder: 30, isSystem: true },
    { name: "Otros ingresos", type: "income", color: "#64748b", icon: "shapes", sortOrder: 40, isSystem: true },
    { name: "Alimentos", type: "expense", color: "#ea580c", icon: "shopping-cart", sortOrder: 10, isSystem: true },
    { name: "Transporte", type: "expense", color: "#2563eb", icon: "car", sortOrder: 20, isSystem: true },
    { name: "Vivienda", type: "expense", color: "#7c3aed", icon: "house", sortOrder: 30, isSystem: true },
    { name: "Salud", type: "expense", color: "#db2777", icon: "heart-pulse", sortOrder: 40, isSystem: true },
    { name: "Entretenimiento", type: "expense", color: "#eab308", icon: "gamepad-2", sortOrder: 50, isSystem: true },
    { name: "Suscripciones", type: "expense", color: "#06b6d4", icon: "circle-dollar-sign", sortOrder: 60, isSystem: true },
    { name: "Compras", type: "expense", color: "#f43f5e", icon: "shopping-cart", sortOrder: 70, isSystem: true },
    { name: "Educación", type: "expense", color: "#0ea5e9", icon: "graduation-cap", sortOrder: 80, isSystem: true },
    { name: "Otros gastos", type: "expense", color: "#64748b", icon: "shapes", sortOrder: 90, isSystem: true },
] as const satisfies readonly CategoryRecord[];
