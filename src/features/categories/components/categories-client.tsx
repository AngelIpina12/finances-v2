"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Archive, FolderPlus, Plus, X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CardTitle } from "@/components/ui/card";
import { archiveCategory, bootstrapDefaultCategories } from "../actions/category-actions";
import type { CategoryListItem } from "../queries/get-categories";
import { createCategoryDraft, toCategoryDraft } from "../utils/category-draft";
import { CategoryForm } from "./category-form";
import { CategoryGroup } from "./category-group";
import { motion } from 'framer-motion';

interface Props {
    categories: CategoryListItem[];
}

export function CategoriesClient({ categories }: Props) {
    const router = useRouter();
    const [categoryToEdit, setCategoryToEdit] = useState<CategoryListItem | "new" | null>(null);
    const [categoryToArchive, setCategoryToArchive] = useState<CategoryListItem | null>(null);
    const [isArchiving, startArchive] = useTransition();
    const [isBootstrapping, startBootstrap] = useTransition();

    const expenses = categories.filter((category) => category.type === "expense");
    const incomes = categories.filter((category) => category.type === "income");

    function bootstrap() {
        startBootstrap(async () => {
            const result = await bootstrapDefaultCategories();

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            router.refresh();
        });
    }

    function archiveSelectedCategory() {
        if (!categoryToArchive) return;

        startArchive(async () => {
            const result = await archiveCategory(categoryToArchive.id);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            setCategoryToArchive(null);
            router.refresh();
        });
    }

    return (
        <div className="space-y-7">
            <motion.header
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
            >
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground">
                        Organiza tus movimientos
                    </p>
                    <CardTitle className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">
                        Categorías
                    </CardTitle>
                    <p className="text-muted-foreground">
                        Clasifica tus ingresos y gastos para entender mejor tu dinero.
                    </p>
                </div>
                <Button size="lg" onClick={() => setCategoryToEdit("new")} className="cursor-pointer">
                    <Plus />
                    Nueva categoría
                </Button>
            </motion.header>

            {!categories.length ? (
                <section className="grid min-h-80 place-items-center rounded-2xl border border-dashed bg-muted/25 p-8 text-center">
                    <div className="max-w-md">
                        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                            <FolderPlus />
                        </span>
                        <h2 className="mt-5 text-xl font-semibold">Prepara tus categorías</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Crea las opciones iniciales para clasificar ingresos y gastos.
                            Después podrás personalizarlas.
                        </p>
                        <div className="mt-5 flex flex-wrap justify-center gap-2">
                            <Button onClick={bootstrap} disabled={isBootstrapping}>
                                <FolderPlus />
                                {isBootstrapping ? "Preparando..." : "Crear categorías iniciales"}
                            </Button>
                            <Button variant="outline" onClick={() => setCategoryToEdit("new")}>
                                Crear una manualmente
                            </Button>
                        </div>
                    </div>
                </section>
            ) : (
                <div className="grid gap-5 lg:grid-cols-2">
                    <CategoryGroup
                        title="Gastos"
                        type="expense"
                        categories={expenses}
                        onEdit={setCategoryToEdit}
                        onArchive={setCategoryToArchive}
                    />
                    <CategoryGroup
                        title="Ingresos"
                        type="income"
                        categories={incomes}
                        onEdit={setCategoryToEdit}
                        onArchive={setCategoryToArchive}
                    />
                </div>
            )}

            <Dialog
                open={categoryToEdit !== null}
                onOpenChange={(open) => !open && setCategoryToEdit(null)}
            >
                <DialogContent
                    className="w-[calc(100vw-2rem)] max-w-none p-6 sm:w-[min(92vw,32rem)] sm:max-w-none"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="font-serif text-2xl">
                                    {categoryToEdit === "new" ? "Nueva categoría" : "Editar categoría"}
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    Crea una opción para clasificar tus movimientos.
                                </DialogDescription>
                            </div>
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setCategoryToEdit(null)}
                            >
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    {categoryToEdit && (
                        <CategoryForm
                            key={categoryToEdit === "new" ? "new" : categoryToEdit.id}
                            initialValues={
                                categoryToEdit === "new"
                                    ? createCategoryDraft()
                                    : toCategoryDraft(categoryToEdit)
                            }
                            typeLocked={
                                categoryToEdit !== "new"
                                && categoryToEdit.transactionCount > 0
                            }
                            onClose={() => setCategoryToEdit(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={categoryToArchive !== null}
                onOpenChange={(open) => !open && setCategoryToArchive(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-destructive/10 text-destructive">
                            <Archive />
                        </AlertDialogMedia>
                        <AlertDialogTitle>¿Archivar esta categoría?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {categoryToArchive
                                ? `“${categoryToArchive.name}” dejará de aparecer al crear movimientos nuevos. El historial se conservará.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isArchiving}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={isArchiving}
                            onClick={archiveSelectedCategory}
                        >
                            {isArchiving ? "Archivando..." : "Archivar categoría"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}