"use client";

import { motion } from "framer-motion";
import {
    CalendarPlus, CheckCircle2, Forward,
    Plus, X, XCircle,
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
import {
    getBalanceDelta, getCreditLimitImpact,
} from "@/src/features/transactions/domain/transaction-rules";
import { CreditLimitWarning } from "@/src/features/transactions/components/credit-limit-warning";
import {
    cancelScheduledOccurrence, completeScheduledOccurrence, skipScheduledOccurrence,
} from "../actions/scheduled-occurrence-actions";
import type { ScheduledOccurrenceListItem } from "../queries/get-scheduled-occurrence-data";
import type { RecurringRuleListItem } from "../queries/get-scheduled-occurrence-data";
import { RecurringRulesPanel } from "@/src/features/recurring-movements/components/recurring-rules-panel";
import { ScheduledOccurrenceForm } from "./scheduled-occurrence-form";
import {
    ScheduledOccurrenceList, type ScheduledAction, type ScheduledFilter,
} from "./scheduled-occurrence-list";
import { ScheduledSummary } from "./scheduled-summary";

type FormProps = React.ComponentProps<typeof ScheduledOccurrenceForm>;

interface Props {
    accounts: FormProps["accounts"];
    categories: FormProps["categories"];
    occurrences: ScheduledOccurrenceListItem[];
    rules: RecurringRuleListItem[];
    now: Date;
}

const filters: Array<{ value: ScheduledFilter; label: string }> = [
    { value: "upcoming", label: "Próximos" },
    { value: "overdue", label: "Vencidos" },
    { value: "completed", label: "Completados" },
    { value: "skipped", label: "Omitidos" },
    { value: "cancelled", label: "Cancelados" },
    { value: "all", label: "Todos" },
];

const actionCopy = {
    complete: {
        title: "¿Completar este movimiento?",
        description: "Se creará una transacción real y el saldo de la cuenta se actualizará una sola vez.",
        button: "Completar y actualizar saldo",
        icon: CheckCircle2,
    },
    skip: {
        title: "¿Omitir este movimiento?",
        description: "Quedará registrado como omitido y no tendrá ningún efecto en el saldo.",
        button: "Omitir esta vez",
        icon: Forward,
    },
    cancel: {
        title: "¿Cancelar este movimiento?",
        description: "Dejará de estar pendiente y no modificará el saldo de ninguna cuenta.",
        button: "Cancelar movimiento",
        icon: XCircle,
    },
} as const;

export function ScheduledClient({ accounts, categories, occurrences, rules, now }: Props) {
    const router = useRouter();
    const [formOpen, setFormOpen] = useState(false);
    const [filter, setFilter] = useState<ScheduledFilter>("upcoming");
    const [view, setView] = useState<"occurrences" | "rules">("occurrences");
    const [selection, setSelection] = useState<{
        occurrence: ScheduledOccurrenceListItem;
        action: ScheduledAction;
    } | null>(null);
    const [isMutating, startMutation] = useTransition();
    const canCreate = accounts.length > 0 && categories.length > 0;
    const copy = selection ? actionCopy[selection.action] : null;
    const completionAccount = selection?.action === "complete"
        ? accounts.find((account) => account.id === selection.occurrence.accountId)
        : undefined;
    const completionImpact = completionAccount && selection?.action === "complete"
        ? getCreditLimitImpact(
            completionAccount,
            getBalanceDelta(
                completionAccount,
                selection.occurrence.transactionType,
                Number(selection.occurrence.amount),
            ),
        )
        : null;
    const exceedsCreditLimit = (completionImpact?.newlyOverLimit ?? 0) > 0;

    function closeForm() {
        setFormOpen(false);
        router.refresh();
    }

    function confirmAction() {
        if (!selection) return;

        startMutation(async () => {
            const result = selection.action === "complete"
                ? await completeScheduledOccurrence(
                    selection.occurrence.id,
                    exceedsCreditLimit,
                )
                : selection.action === "skip"
                    ? await skipScheduledOccurrence(selection.occurrence.id)
                    : await cancelScheduledOccurrence(selection.occurrence.id);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            setSelection(null);
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
                        Tu dinero, antes de que ocurra
                    </p>
                    <CardTitle className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">
                        Programados
                    </CardTitle>
                    <p className="max-w-2xl text-muted-foreground">
                        Organiza ingresos y gastos futuros. Tu saldo sólo cambiará
                        cuando confirmes que realmente ocurrieron.
                    </p>
                </div>
                <Button
                    size="lg"
                    onClick={() => setFormOpen(true)}
                    disabled={!canCreate}
                    className="cursor-pointer"
                >
                    <Plus />
                    Programar movimiento
                </Button>
            </motion.header>

            <div className="flex gap-2 overflow-x-auto pb-1">
                <Button
                    type="button"
                    size="sm"
                    variant={view === "occurrences" ? "default" : "outline"}
                    onClick={() => setView("occurrences")}
                    className="shrink-0 cursor-pointer"
                >
                    Calendario
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant={view === "rules" ? "default" : "outline"}
                    onClick={() => setView("rules")}
                    className="shrink-0 cursor-pointer"
                >
                    Recurrencias {rules.length ? `(${rules.length})` : ""}
                </Button>
            </div>

            {view === "rules" ? (
                <RecurringRulesPanel accounts={accounts} categories={categories} rules={rules} />
            ) : (
                <>
                    <ScheduledSummary occurrences={occurrences} now={now} />
                    {!accounts.length ? (
                        <EmptyState
                            title="Primero agrega una cuenta"
                            description="Necesitamos saber dónde se recibirá o pagará el movimiento."
                            onAction={() => router.push("/accounts")}
                            actionLabel="Ir a cuentas"
                        />
                    ) : !categories.length ? (
                        <EmptyState
                            title="Prepara tus categorías"
                            description="Cada movimiento programado necesita una categoría de ingreso o gasto."
                            onAction={() => router.push("/categories")}
                            actionLabel="Ir a categorías"
                        />
                    ) : (
                        <>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {filters.map((item) => (
                                    <Button
                                        key={item.value}
                                        type="button"
                                        size="sm"
                                        variant={filter === item.value ? "default" : "outline"}
                                        onClick={() => setFilter(item.value)}
                                        className="shrink-0 cursor-pointer"
                                    >
                                        {item.label}
                                    </Button>
                                ))}
                            </div>
                            <ScheduledOccurrenceList
                                occurrences={occurrences}
                                filter={filter}
                                now={now}
                                onAction={(occurrence, action) => (
                                    setSelection({ occurrence, action })
                                )}
                            />
                        </>
                    )}
                </>
            )}

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent
                    className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-none overflow-y-auto p-6 sm:w-[min(92vw,42rem)] sm:max-w-none"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="font-serif text-2xl">
                                    Programar movimiento
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    Define qué esperas que ocurra y cuándo.
                                </DialogDescription>
                            </div>
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setFormOpen(false)}
                                className="cursor-pointer"
                            >
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    <ScheduledOccurrenceForm
                        accounts={accounts}
                        categories={categories}
                        onClose={closeForm}
                    />
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={selection !== null}
                onOpenChange={(open) => !open && setSelection(null)}
            >
                <AlertDialogContent>
                    {copy && (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogMedia className={selection?.action === "cancel"
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-primary/10 text-primary"}
                                >
                                    <copy.icon />
                                </AlertDialogMedia>
                                <AlertDialogTitle>{copy.title}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    <strong className="font-medium text-foreground">
                                        {selection?.occurrence.name}.
                                    </strong>{" "}
                                    {copy.description}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            {exceedsCreditLimit && completionImpact && completionAccount && (
                                <CreditLimitWarning
                                    impact={completionImpact}
                                    currency={completionAccount.currency}
                                />
                            )}
                            <AlertDialogFooter>
                                <AlertDialogCancel
                                    disabled={isMutating}
                                    className="cursor-pointer"
                                >
                                    Volver
                                </AlertDialogCancel>
                                <AlertDialogAction
                                    variant={selection?.action === "cancel"
                                        ? "destructive"
                                        : "default"}
                                    disabled={isMutating}
                                    onClick={confirmAction}
                                    className="cursor-pointer"
                                >
                                    {isMutating
                                        ? "Procesando..."
                                        : exceedsCreditLimit
                                            ? "Registrar de todos modos"
                                            : copy.button}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function EmptyState({
    title,
    description,
    actionLabel,
    onAction,
}: {
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
}) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid min-h-80 place-items-center rounded-2xl border border-dashed bg-muted/20 p-8 text-center"
        >
            <div className="max-w-sm">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                    <CalendarPlus />
                </span>
                <h2 className="mt-4 text-xl font-semibold">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                <Button onClick={onAction} className="mt-5 cursor-pointer">
                    {actionLabel}
                </Button>
            </div>
        </motion.section>
    );
}
