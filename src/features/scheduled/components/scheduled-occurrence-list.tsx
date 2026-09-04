"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
    ArrowDownLeft, ArrowUpRight, Check,
    Clock3, Ellipsis, Forward,
    XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";
import {
    formatAppDate, formatAppDateTime, toAppDateInputValue,
} from "@/src/shared/utils/local-date-time";
import type { ScheduledOccurrenceListItem } from "../queries/get-scheduled-occurrence-data";

export type ScheduledFilter =
    | "upcoming"
    | "overdue"
    | "completed"
    | "skipped"
    | "cancelled"
    | "all";

export type ScheduledAction = "complete" | "skip" | "cancel";

interface Props {
    occurrences: ScheduledOccurrenceListItem[];
    filter: ScheduledFilter;
    now: Date;
    onAction: (
        occurrence: ScheduledOccurrenceListItem,
        action: ScheduledAction,
    ) => void;
}

const statusLabels = {
    scheduled: "Programado",
    completed: "Completado",
    skipped: "Omitido",
    cancelled: "Cancelado",
} as const;

function matchesFilter(occurrence: ScheduledOccurrenceListItem, filter: ScheduledFilter, now: number) {
    if (filter === "all") return true;
    if (filter === "upcoming") {
        return occurrence.status === "scheduled"
            && occurrence.scheduledAt.getTime() >= now;
    }
    if (filter === "overdue") {
        return occurrence.status === "scheduled"
            && occurrence.scheduledAt.getTime() < now;
    }

    return occurrence.status === filter;
}

function money(amount: string, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
    }).format(Number(amount));
}

export function ScheduledOccurrenceList({ occurrences, filter, now, onAction }: Props) {
    const nowTimestamp = now.getTime();
    const visible = occurrences
        .filter((occurrence) => (
            matchesFilter(occurrence, filter, nowTimestamp)
        ))
        .sort((left, right) => (
            left.scheduledAt.getTime() - right.scheduledAt.getTime()
        ));
    const groups = visible.reduce(
        (result, occurrence) => {
            const date = toAppDateInputValue(occurrence.scheduledAt);
            const current = result.get(date) ?? [];
            current.push(occurrence);
            result.set(date, current);
            return result;
        },
        new Map<string, ScheduledOccurrenceListItem[]>(),
    );

    if (!visible.length) {
        return (
            <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-muted/20 p-8 text-center"
            >
                <div className="max-w-sm">
                    <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                        <Clock3 />
                    </span>
                    <h2 className="mt-4 text-xl font-semibold">
                        No hay movimientos en esta vista
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Cambia el filtro o programa un movimiento para comenzar.
                    </p>
                </div>
            </motion.section>
        );
    }

    return (
        <div className="space-y-6">
            {[...groups.entries()].map(([date, items]) => (
                <motion.section
                    key={date}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    layout
                    className="space-y-2"
                >
                    <p className="font-label px-1 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {formatAppDate(items[0].scheduledAt, {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                        })}
                    </p>

                    <div className="overflow-hidden rounded-2xl border bg-card">
                        <div className="divide-y">
                            {items.map((occurrence, index) => {
                                const income = occurrence.transactionType === "income";
                                const overdue = occurrence.status === "scheduled"
                                    && occurrence.scheduledAt.getTime() < nowTimestamp;
                                const terminal = occurrence.status !== "scheduled";
                                const Icon = income ? ArrowUpRight : ArrowDownLeft;

                                return (
                                    <motion.article
                                        key={occurrence.id}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: terminal ? 0.62 : 1, x: 0 }}
                                        transition={{ delay: Math.min(index, 8) * 0.035 }}
                                        layout
                                        className="flex items-center gap-3 p-4 sm:p-5"
                                    >
                                        <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${income
                                            ? "bg-emerald-500/10 text-emerald-600"
                                            : "bg-rose-500/10 text-rose-600"
                                            }`}
                                        >
                                            <Icon className="size-5" />
                                        </span>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate font-medium">
                                                    {occurrence.name}
                                                </p>
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${overdue
                                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                                    : occurrence.status === "completed"
                                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                                        : occurrence.status === "cancelled"
                                                            ? "bg-destructive/10 text-destructive"
                                                            : "bg-muted text-muted-foreground"
                                                    }`}
                                                >
                                                    {overdue
                                                        ? "Vencido"
                                                        : statusLabels[occurrence.status]}
                                                </span>
                                            </div>
                                            <p className="mt-1 truncate text-xs text-muted-foreground">
                                                {occurrence.categoryName ?? "Sin categoría"}
                                                {" · "}
                                                {occurrence.accountName}
                                                {" · "}
                                                {formatAppDateTime(occurrence.scheduledAt)}
                                            </p>
                                            {occurrence.notes && (
                                                <p className="mt-1 truncate text-xs text-muted-foreground/80">
                                                    {occurrence.notes}
                                                </p>
                                            )}
                                        </div>

                                        <p className={`shrink-0 text-sm font-semibold ${income
                                            ? "text-emerald-600"
                                            : "text-foreground"
                                            }`}
                                        >
                                            {income ? "+" : "-"}
                                            {money(occurrence.amount, occurrence.currency)}
                                        </p>

                                        {occurrence.status === "scheduled" && occurrence.source === "financing_installment" && (
                                            <Link
                                                href="/financing"
                                                className="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors hover:bg-muted"
                                            >
                                                Pagar cuota
                                            </Link>
                                        )}

                                        {occurrence.status === "scheduled" && occurrence.source !== "financing_installment" && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger
                                                    render={(
                                                        <Button
                                                            type="button"
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            className="cursor-pointer"
                                                        >
                                                            <Ellipsis />
                                                            <span className="sr-only">
                                                                Acciones
                                                            </span>
                                                        </Button>
                                                    )}
                                                />
                                                <DropdownMenuContent align="end" className="min-w-44">
                                                    <DropdownMenuItem
                                                        onClick={() => onAction(occurrence, "complete")}
                                                        className="cursor-pointer"
                                                    >
                                                        <Check />
                                                        Marcar completado
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => onAction(occurrence, "skip")}
                                                        className="cursor-pointer"
                                                    >
                                                        <Forward />
                                                        Omitir esta vez
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onClick={() => onAction(occurrence, "cancel")}
                                                        className="cursor-pointer"
                                                    >
                                                        <XCircle />
                                                        Cancelar
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </motion.article>
                                );
                            })}
                        </div>
                    </div>
                </motion.section>
            ))}
        </div>
    );
}
