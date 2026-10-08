"use client";

import {
    ArrowDownLeft, Receipt, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatAppDate, formatAppDateTime } from "@/src/shared/utils/local-date-time";
import type { BudgetsData } from "../queries/get-budgets";

type Budget = BudgetsData["budgets"][number];

const money = (amount: number, currency: string) => new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
}).format(amount);

function formatPeriod(start: Date | null, end: Date | null) {
    if (!start || !end) return "Sin periodo activo";

    const lastDay = new Date(end.getTime() - 1);
    const options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

    return `${formatAppDate(start, options)} – ${formatAppDate(lastDay, options)}`;
}

interface Props {
    budget: Budget | null;
    onClose: () => void;
}

export function BudgetExpensesDialog({ budget, onClose }: Props) {
    return (
        <Dialog open={budget !== null} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-none overflow-y-auto p-6 sm:w-[min(92vw,40rem)] sm:max-w-none"
                showCloseButton={false}
            >
                {budget && (
                    <>
                        <DialogHeader>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <DialogTitle className="font-serif text-2xl">
                                        Gastos de {budget.name}
                                    </DialogTitle>
                                    <DialogDescription className="mt-1">
                                        Periodo actual: {formatPeriod(budget.periodStart, budget.periodEnd)}
                                    </DialogDescription>
                                </div>
                                <Button
                                    type="button"
                                    size="icon-sm"
                                    variant="ghost"
                                    className="cursor-pointer"
                                    onClick={onClose}
                                >
                                    <X />
                                    <span className="sr-only">Cerrar</span>
                                </Button>
                            </div>
                        </DialogHeader>

                        <div className="flex items-end justify-between rounded-xl bg-muted/40 p-4">
                            <div>
                                <p className="text-xs text-muted-foreground">Total gastado</p>
                                <p className="mt-1 text-xl font-semibold">
                                    {money(budget.spent, budget.currency)}
                                </p>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {budget.expenses.length} {budget.expenses.length === 1 ? "movimiento" : "movimientos"}
                            </p>
                        </div>

                        {!budget.expenses.length ? (
                            <div className="grid place-items-center rounded-xl border border-dashed p-8 text-center">
                                <Receipt className="size-8 text-muted-foreground" />
                                <p className="mt-3 text-sm text-muted-foreground">
                                    Aún no hay gastos en este periodo.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y overflow-hidden rounded-xl border">
                                {budget.expenses.map((expense) => {
                                    const partial = expense.budgetAmount !== expense.amount;

                                    return (
                                        <article key={expense.id} className="flex items-center gap-3 p-4">
                                            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-600">
                                                <ArrowDownLeft className="size-4" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate font-medium">
                                                    {expense.merchant || expense.categoryName || "Movimiento"}
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {expense.categoryName || "Sin categoría"} · {expense.accountName} · {formatAppDateTime(expense.date)}
                                                </p>
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className="font-semibold">
                                                    {money(expense.budgetAmount, budget.currency)}
                                                </p>
                                                {partial && (
                                                    <p className="text-xs text-muted-foreground">
                                                        de {money(expense.amount, budget.currency)}
                                                    </p>
                                                )}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
