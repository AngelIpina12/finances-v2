"use client";

import { motion } from "framer-motion";
import {
    Archive, CirclePause, Pencil,
    Play, Plus, RefreshCw,
    Repeat2, X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { formatAppDateTime } from "@/src/shared/utils/local-date-time";
import {
    archiveRecurringRule, generateRecurringOccurrences, pauseRecurringRule,
    resumeRecurringRule,
} from "../actions/recurring-rule-actions";
import type { RecurringRuleListItem } from "@/src/features/scheduled/queries/get-scheduled-occurrence-data";
import { toRecurringRuleDraft } from "../utils/recurring-rule-draft";
import { RecurringRuleForm } from "./recurring-rule-form";

type FormProps = React.ComponentProps<typeof RecurringRuleForm>;

interface Props {
    accounts: FormProps["accounts"];
    categories: FormProps["categories"];
    rules: RecurringRuleListItem[];
}

const frequencyLabels = {
    weekly: "Cada semana",
    biweekly: "Cada 14 días",
    monthly: "Cada mes",
    yearly: "Cada año",
} as const;

function formatMoney(amount: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function RecurringRulesPanel({ accounts, categories, rules }: Props) {
    const router = useRouter();
    const [ruleToEdit, setRuleToEdit] = useState<RecurringRuleListItem | "new" | null>(null);
    const [ruleToArchive, setRuleToArchive] = useState<RecurringRuleListItem | null>(null);
    const [isMutating, startMutation] = useTransition();
    const canCreate = accounts.length > 0 && categories.length > 0;

    function closeForm() {
        setRuleToEdit(null);
        router.refresh();
    }

    function runMutation(operation: () => Promise<{ success: boolean; message: string }>, onSuccess?: () => void) {
        startMutation(async () => {
            const result = await operation();

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onSuccess?.();
            router.refresh();
        });
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                    <p className="font-label text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">
                        Reglas que crean tus próximos movimientos
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Las fechas generadas se revisan antes de afectar cualquier saldo.
                    </p>
                </div>
                <Button
                    onClick={() => setRuleToEdit("new")}
                    disabled={!canCreate}
                    className="cursor-pointer"
                >
                    <Plus />
                    Nueva recurrencia
                </Button>
            </div>

            {!rules.length ? (
                <motion.section
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-muted/20 p-8 text-center"
                >
                    <div className="max-w-sm">
                        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                            <Repeat2 />
                        </span>
                        <CardTitle className="mt-4 text-xl">Tu primera recurrencia empieza aquí</CardTitle>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Registra suscripciones, servicios, salarios o cualquier movimiento que se repite.
                        </p>
                        <Button
                            onClick={() => setRuleToEdit("new")}
                            disabled={!canCreate}
                            className="mt-5 cursor-pointer"
                        >
                            <Plus />
                            Crear recurrencia
                        </Button>
                    </div>
                </motion.section>
            ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                    {rules.map((rule, index) => {
                        const income = rule.transactionType === "income";

                        return (
                            <motion.article
                                key={rule.id}
                                initial={{ opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: Math.min(index, 8) * 0.04 }}
                                className="rounded-2xl border bg-card p-5 shadow-sm"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h2 className="truncate font-semibold">{rule.name}</h2>
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${rule.isActive
                                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                                : "bg-muted text-muted-foreground"
                                                }`}>
                                                {rule.isActive ? "Activa" : "Pausada"}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-muted-foreground">
                                            {frequencyLabels[rule.frequency as keyof typeof frequencyLabels]}
                                            {" · "}{rule.accountName}
                                        </p>
                                    </div>
                                    <p className={`shrink-0 text-lg font-semibold ${income ? "text-emerald-600" : "text-foreground"}`}>
                                        {income ? "+" : "-"}{formatMoney(rule.amount, rule.currency)}
                                    </p>
                                </div>

                                <div className="mt-5 grid gap-3 rounded-xl bg-muted/50 p-3 text-xs sm:grid-cols-2">
                                    <p className="text-muted-foreground">
                                        <span className="block font-medium text-foreground">Próxima fecha</span>
                                        {rule.nextOccurrenceAt
                                            ? formatAppDateTime(rule.nextOccurrenceAt)
                                            : rule.isActive
                                                ? "Sin fechas en la ventana actual"
                                                : "Pausada"}
                                    </p>
                                    <p className="text-muted-foreground">
                                        <span className="block font-medium text-foreground">Categoría</span>
                                        {rule.categoryName ?? "Sin categoría"}
                                    </p>
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setRuleToEdit(rule)}
                                        disabled={isMutating}
                                        className="cursor-pointer"
                                    >
                                        <Pencil />
                                        Editar
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => runMutation(
                                            () => rule.isActive
                                                ? pauseRecurringRule(rule.id)
                                                : resumeRecurringRule(rule.id),
                                        )}
                                        disabled={isMutating}
                                        className="cursor-pointer"
                                    >
                                        {rule.isActive ? <CirclePause /> : <Play />}
                                        {rule.isActive ? "Pausar" : "Reanudar"}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => runMutation(() => generateRecurringOccurrences(rule.id))}
                                        disabled={isMutating || !rule.isActive}
                                        className="cursor-pointer"
                                    >
                                        <RefreshCw />
                                        Actualizar fechas
                                    </Button>
                                    <Button
                                        type="button"
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => setRuleToArchive(rule)}
                                        disabled={isMutating}
                                        aria-label={`Archivar ${rule.name}`}
                                        className="ml-auto cursor-pointer text-muted-foreground hover:text-destructive"
                                    >
                                        <Archive />
                                    </Button>
                                </div>
                            </motion.article>
                        );
                    })}
                </div>
            )}

            <Dialog
                open={ruleToEdit !== null}
                onOpenChange={(open) => !open && setRuleToEdit(null)}
            >
                <DialogContent
                    className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-none overflow-y-auto p-6 sm:w-[min(92vw,42rem)] sm:max-w-none"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="font-serif text-2xl">
                                    {ruleToEdit === "new" ? "Nueva recurrencia" : "Editar recurrencia"}
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    Los cambios afectarán las nuevas fechas que se generen; el historial se conserva.
                                </DialogDescription>
                            </div>
                            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setRuleToEdit(null)} className="cursor-pointer">
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    {ruleToEdit && (
                        <RecurringRuleForm
                            key={ruleToEdit === "new" ? "new" : ruleToEdit.id}
                            accounts={accounts}
                            categories={categories}
                            initialValues={ruleToEdit === "new" ? undefined : toRecurringRuleDraft({
                                ...ruleToEdit,
                                transactionType: ruleToEdit.transactionType as "income" | "expense",
                            })}
                            onClose={closeForm}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={ruleToArchive !== null}
                onOpenChange={(open) => !open && setRuleToArchive(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-destructive/10 text-destructive">
                            <Archive />
                        </AlertDialogMedia>
                        <AlertDialogTitle>¿Archivar esta recurrencia?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {ruleToArchive
                                ? `“${ruleToArchive.name}” dejará de generar fechas nuevas. Las ocurrencias y transacciones existentes se conservarán.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isMutating} className="cursor-pointer">Volver</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={isMutating}
                            onClick={() => ruleToArchive && runMutation(
                                () => archiveRecurringRule(ruleToArchive.id),
                                () => setRuleToArchive(null),
                            )}
                            className="cursor-pointer"
                        >
                            {isMutating ? "Archivando..." : "Archivar recurrencia"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
