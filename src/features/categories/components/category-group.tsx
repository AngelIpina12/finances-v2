"use client"

import {
    Archive, MoreHorizontal, Pencil
} from "lucide-react";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { CategoryType } from "../domain/category-repository";
import { CategoryIcon } from "./category-icon";
import type { CategoryListItem } from "../queries/get-categories";
import { motion } from 'framer-motion';

interface Props {
    title: string;
    type: CategoryType;
    categories: CategoryListItem[];
    onEdit: (category: CategoryListItem) => void;
    onArchive: (category: CategoryListItem) => void;
}

export function CategoryGroup({ title, type, categories, onEdit, onArchive }: Props) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border bg-card"
        >
            <header className="flex items-center justify-between border-b px-5 py-4">
                <div className="flex items-center gap-2 font-semibold">
                    <span className={type === "expense" ? "text-rose-600" : "text-emerald-600"}>
                        {type === "expense" ? "↗" : "↙"}
                    </span>
                    {title}
                </div>
                <span className="text-xs text-muted-foreground">
                    {categories.length} {categories.length === 1 ? "categoría" : "categorías"}
                </span>
            </header>
            {categories.length ? (
                <div className="divide-y">
                    {categories.map((category) => (
                        <article
                            key={category.id}
                            className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-5 py-4"
                        >
                            <span
                                className="grid size-10 place-items-center rounded-xl"
                                style={{
                                    color: category.color || "#64748b",
                                    backgroundColor: `${category.color || "#64748b"}18`,
                                }}
                            >
                                <CategoryIcon icon={category.icon} className="size-5" />
                            </span>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="truncate font-medium">{category.name}</p>
                                    {category.isSystem && (
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                            Predeterminada
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {category.transactionCount} {category.transactionCount === 1 ? "movimiento" : "movimientos"}
                                </p>
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger
                                    render={<Button type="button" variant="ghost" size="icon-sm" className="cursor-pointer" />}
                                >
                                    <MoreHorizontal />
                                    <span className="sr-only">Acciones de {category.name}</span>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="min-w-36">
                                    <DropdownMenuItem
                                        onClick={() => onEdit(category)}
                                        className="cursor-pointer"
                                    >
                                        <Pencil />
                                        Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        variant="destructive"
                                        onClick={() => onArchive(category)}
                                        className="cursor-pointer"
                                    >
                                        <Archive />
                                        Archivar
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </article>
                    ))}
                </div>
            ) : (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                    Aún no tienes categorías de {type === "expense" ? "gasto" : "ingreso"}.
                </div>
            )}
        </motion.section>
    );
}