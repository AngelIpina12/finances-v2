import {
    BriefcaseBusiness, Car, ChartNoAxesCombined,
    CircleDollarSign, Gamepad2, GraduationCap,
    HeartPulse, House, Shapes,
    ShoppingCart,
} from "lucide-react";
import type { CategoryIconKey } from "../domain/category-repository";

const icons = {
    "shopping-cart": ShoppingCart,
    house: House,
    car: Car,
    "heart-pulse": HeartPulse,
    "gamepad-2": Gamepad2,
    "graduation-cap": GraduationCap,
    "briefcase-business": BriefcaseBusiness,
    "circle-dollar-sign": CircleDollarSign,
    "chart-no-axes-combined": ChartNoAxesCombined,
    shapes: Shapes,
} satisfies Record<CategoryIconKey, typeof Shapes>;

export function CategoryIcon({ icon, className }: { icon?: string | null; className?: string }) {
    const Icon = icons[icon as CategoryIconKey] ?? Shapes;
    return <Icon className={className} />;
}
