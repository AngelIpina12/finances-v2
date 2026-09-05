"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
    Archive, PieChart, Plus,
    X
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
import { CardTitle } from "@/src/shared/components/ui/card";
import { archiveBudget } from "../actions/budget-actions";
import type { BudgetsData } from "../queries/get-budgets";
import { createBudgetDraft, toBudgetDraft } from "../utils/budget-draft";
import { BudgetForm } from "./budget-form";

const money = (amount: number, currency: string) => new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
}).format(amount);

export function BudgetsClient({ budgets, categories }: BudgetsData) {
    const router = useRouter();
    const [selected, setSelected] = useState<BudgetsData["budgets"][number] | "new" | null>(null);
    const [budgetToArchive, setBudgetToArchive] = useState<BudgetsData["budgets"][number] | null>(null);
    const [isArchiving, startArchive] = useTransition();

    function closeForm() {
        setSelected(null);
        router.refresh();
    }

    function archiveSelectedBudget() {
        if (!budgetToArchive) return;

        startArchive(async () => {
            const result = await archiveBudget(budgetToArchive.id);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            setBudgetToArchive(null);
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
                    <p className="font-label text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground">
                        Decide cuánto quieres gastar
                    </p>
                    <CardTitle className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">
                        Presupuestos
                    </CardTitle>
                    <p className="text-muted-foreground">
                        Tus gastos reales se calculan desde los movimientos completados.
                    </p>
                </div>
                <Button size="lg" className="cursor-pointer" onClick={() => setSelected("new")}>
                    <Plus /> Nuevo presupuesto
                </Button>
            </motion.header>

            {!budgets.length ? (
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid min-h-80 place-items-center rounded-2xl border border-dashed bg-muted/25 p-8 text-center"
                >
                    <div className="max-w-md">
                        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                            <PieChart />
                        </span>
                        <h2 className="mt-5 text-xl font-semibold">Dale un límite a tus gastos</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Crea un presupuesto global o asígnalo a las categorías que quieras controlar.
                        </p>
                        <Button className="mt-5 cursor-pointer" onClick={() => setSelected("new")}>
                            <Plus /> Crear presupuesto
                        </Button>
                    </div>
                </motion.section>
            ) : (
                <motion.section layout className="grid gap-5 xl:grid-cols-2">
                    <AnimatePresence mode="popLayout">
                        {budgets.map((budget, index) => (
                            <motion.article
                                layout
                                key={budget.id}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="rounded-2xl border bg-card p-5 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="font-semibold">{budget.name}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {budget.allocations.length
                                                ? budget.allocations.map((item) => item.categoryName).join(" · ")
                                                : "Todos los gastos"}
                                        </p>
                                    </div>
                                    <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        className="cursor-pointer"
                                        disabled={isArchiving}
                                        onClick={() => setBudgetToArchive(budget)}
                                    >
                                        <Archive className="size-4" />
                                        <span className="sr-only">Archivar</span>
                                    </Button>
                                </div>
                                <div className="mt-6 flex items-end justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Gastado</p>
                                        <p className="mt-1 text-2xl font-semibold">
                                            {money(budget.spent, budget.currency)}
                                        </p>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        de {money(budget.availableAmount, budget.currency)}
                                    </p>
                                </div>
                                <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(budget.usage, 100)}%` }}
                                        className={budget.status === "exceeded"
                                            ? "h-full bg-destructive"
                                            : budget.status === "warning"
                                                ? "h-full bg-amber-500"
                                                : "h-full"
                                        }
                                        style={budget.status === "healthy"
                                            ? { backgroundColor: budget.color }
                                            : undefined
                                        }
                                    />
                                </div>
                                <div className="mt-3 flex items-center justify-between text-sm">
                                    <span
                                        className={budget.status === "exceeded"
                                            ? "text-destructive"
                                            : budget.status === "warning"
                                                ? "text-amber-600"
                                                : "text-emerald-600"
                                        }
                                    >
                                        {budget.usage.toFixed(0)}% usado
                                    </span>
                                    <span className="text-muted-foreground">
                                        {budget.remaining >= 0
                                            ? `${money(budget.remaining, budget.currency)} disponible`
                                            : `${money(Math.abs(budget.remaining), budget.currency)} excedido`
                                        }
                                    </span>
                                </div>
                                {budget.allocations.length > 0 && (
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        {budget.unallocatedAmount > 0
                                            ? `${money(budget.unallocatedAmount, budget.currency)} sin asignar a categorías`
                                            : "Todo el límite está asignado a categorías"}
                                    </p>
                                )}
                                {budget.availableAmount !== budget.amount && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                        {budget.availableAmount > budget.amount
                                            ? `Incluye ${money(
                                                budget.availableAmount - budget.amount,
                                                budget.currency,
                                            )} acumulados del periodo anterior.`
                                            : `Incluye un déficit arrastrado de ${money(
                                                budget.amount - budget.availableAmount,
                                                budget.currency,
                                            )}.`
                                        }
                                    </p>
                                )}
                                <div className="mt-5 flex justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="cursor-pointer"
                                        onClick={() => setSelected(budget)}
                                    >
                                        Editar
                                    </Button>
                                </div>
                            </motion.article>
                        ))}
                    </AnimatePresence>
                </motion.section>
            )}

            <Dialog
                open={selected !== null}
                onOpenChange={(open) => !open && setSelected(null)}
            >
                <DialogContent
                    className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-none overflow-y-auto p-6 sm:w-[min(92vw,44rem)] sm:max-w-none"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle
                                    className="font-serif text-2xl"
                                >
                                    {selected === "new"
                                        ? "Nuevo presupuesto"
                                        : "Editar presupuesto"
                                    }
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    Las transferencias y los pagos de tarjeta no suman como gasto.
                                </DialogDescription>
                            </div>
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                className="cursor-pointer"
                                onClick={() => setSelected(null)}
                            >
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    {selected && (
                        <BudgetForm
                            key={selected === "new" ? "new" : selected.id}
                            initialValues={selected === "new" ? createBudgetDraft() : toBudgetDraft(selected)}
                            categories={categories}
                            onClose={closeForm}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={budgetToArchive !== null}
                onOpenChange={(open) => !open && setBudgetToArchive(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-destructive/10 text-destructive">
                            <Archive />
                        </AlertDialogMedia>
                        <AlertDialogTitle>¿Archivar este presupuesto?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {budgetToArchive
                                ? `“${budgetToArchive.name}” dejará de calcular gastos nuevos. El historial y sus movimientos se conservarán.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isArchiving} className="cursor-pointer">
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={isArchiving}
                            onClick={archiveSelectedBudget}
                            className="cursor-pointer"
                        >
                            {isArchiving ? "Archivando..." : "Archivar presupuesto"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
