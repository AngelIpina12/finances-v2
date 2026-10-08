"use client";

import { format } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { es } from "date-fns/locale";
import type { CardStatementItem } from "../domain/card-statement-calculator";
import type {
    CardCycleCharge, ForecastEventSource, ProjectedForecastEvent,
} from "../domain/forecast-calculator";
import { formatMoney } from "./forecast-ui";

type ChargeLine = { id: string; name: string; amount: number; date: Date };
type ChargeGroup = { label: string; lines: ChargeLine[]; reducesPayment?: boolean };

const CHARGE_GROUPS: Array<{ label: string; sources: ForecastEventSource[] }> = [
    { label: "Cargos ya registrados", sources: ["posted_card_charge"] },
    { label: "Movimientos programados", sources: ["scheduled"] },
    { label: "Recurrencias", sources: ["recurring"] },
    { label: "Presupuestos estimados", sources: ["budget"] },
    { label: "Cuotas de financiamiento", sources: ["financing"] },
];

const STATEMENT_GROUPS: Array<{ label: string; kind: CardStatementItem["kind"]; reducesPayment?: boolean }> = [
    { label: "Compras del ciclo", kind: "purchase" },
    { label: "Cuotas de financiamiento", kind: "installment" },
    { label: "Abonos y devoluciones", kind: "credit", reducesPayment: true },
    { label: "Pagos ya realizados", kind: "payment", reducesPayment: true },
];

export function CardPaymentBreakdown({ event }: { event: ProjectedForecastEvent }) {
    const breakdown = event.cardPaymentBreakdown;
    if (!breakdown) return null;

    const hasCalculated = breakdown.calculatedStatementBalance !== null && breakdown.calculatedStatementBalance !== undefined;
    // Con ambos importes a la vista, se señala cuál usa la previsión.
    const marksUsedAmount = hasCalculated && breakdown.statementBalance > 0;
    const groups = breakdown.statementItems?.length
        ? statementGroups(breakdown.statementItems)
        : breakdown.charges?.length
            ? cycleGroups(breakdown.charges)
            : [];
    // Los abonos sólo restan hasta dejar las compras del ciclo en cero; lo que
    // sobra cubrió adeudos anteriores y no reduce las cuotas de MSI.
    const sumOf = (kind: CardStatementItem["kind"]) => (breakdown.statementItems ?? [])
        .filter((item) => item.kind === kind)
        .reduce((sum, item) => sum + item.amount, 0);
    const unappliedCredits = Math.round((sumOf("credit") - sumOf("purchase")) * 100) / 100;

    return (
        <Collapsible
            className="mt-3 rounded-xl bg-muted/60 p-3 text-xs"
            summary={<span className="font-semibold">Ver cálculo del pago</span>}
        >
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {breakdown.closesAt && (
                    <BreakdownItem
                        label="Corte asociado"
                        value={format(breakdown.closesAt, "d 'de' MMMM 'de' yyyy", { locale: es })}
                    />
                )}
                {breakdown.statementBalance > 0 && (
                    <BreakdownItem
                        label="Pago informado por el banco"
                        value={formatMoney(breakdown.statementBalance, event.currency)}
                    />
                )}
                {hasCalculated && (
                    <BreakdownItem
                        label={`Pago calculado con tus movimientos${marksUsedAmount ? " · usado" : ""}`}
                        value={formatMoney(breakdown.calculatedStatementBalance!, event.currency)}
                    />
                )}
                {breakdown.trackedInstallments > 0 && (
                    <BreakdownItem label="Incluye cuotas de MSI" value={formatMoney(breakdown.trackedInstallments, event.currency)} />
                )}
                {breakdown.projectedCharges > 0 && (
                    <BreakdownItem label="Cargos previstos del ciclo" value={formatMoney(breakdown.projectedCharges, event.currency)} />
                )}
                <BreakdownItem
                    label="Pago esperado"
                    value={breakdown.expectedPayment === null
                        ? "Por confirmar manualmente"
                        : formatMoney(breakdown.expectedPayment, event.currency)
                    }
                />
            </dl>
            {groups.length > 0 && <ChargesByGroup groups={groups} currency={event.currency} />}
            {unappliedCredits > 0 && (
                <p className="mt-2 text-muted-foreground">
                    Los abonos superan a las compras del ciclo por {formatMoney(unappliedCredits, event.currency)}.
                    Ese sobrante cubrió adeudos anteriores, así que no reduce las cuotas de MSI ni este pago.
                </p>
            )}
        </Collapsible>
    );
}

function cycleGroups(charges: CardCycleCharge[]): ChargeGroup[] {
    const knownSources = new Set(CHARGE_GROUPS.flatMap((group) => group.sources));
    return [...CHARGE_GROUPS, { label: "Otros cargos", sources: [] as ForecastEventSource[] }].map((group) => ({
        label: group.label,
        lines: charges
            .filter((charge) => (group.sources.length
                ? group.sources.includes(charge.source)
                : !knownSources.has(charge.source)))
            .map((charge) => ({ id: charge.id, name: charge.name, amount: charge.amount, date: charge.scheduledAt })),
    }));
}

function statementGroups(items: CardStatementItem[]): ChargeGroup[] {
    return STATEMENT_GROUPS.map((group) => ({
        label: group.label,
        reducesPayment: group.reducesPayment,
        lines: items.filter((item) => item.kind === group.kind),
    }));
}

function ChargesByGroup({ groups, currency }: { groups: ChargeGroup[]; currency: string }) {
    const visibleGroups = groups
        .filter((group) => group.lines.length > 0)
        .map((group) => ({
            ...group,
            lines: [...group.lines].sort((left, right) => left.date.getTime() - right.date.getTime()),
        }));
    const signed = (group: ChargeGroup, amount: number) => formatMoney(group.reducesPayment ? -amount : amount, currency);

    return (
        <div className="mt-3 space-y-2">
            <p className="font-semibold">Cargos que integran el pago</p>
            <div className="grid items-start gap-2 sm:grid-cols-2">
                {visibleGroups.map((group) => (
                    <Collapsible
                        key={group.label}
                        className="rounded-lg bg-background/70 px-3 py-2"
                        summary={(
                            <span className="flex flex-1 items-center justify-between gap-4">
                                <span className="text-muted-foreground">
                                    {group.label} ({group.lines.length})
                                </span>
                                <span className="font-medium tabular-nums">
                                    {signed(group, group.lines.reduce((sum, line) => sum + line.amount, 0))}
                                </span>
                            </span>
                        )}
                    >
                        <ul className="mt-2 border-t pt-1">
                            {group.lines.map((line) => (
                                <li
                                    key={line.id}
                                    className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 rounded-md px-2 py-1 odd:bg-muted/50"
                                >
                                    <span className="text-muted-foreground tabular-nums">
                                        {format(line.date, "d MMM", { locale: es })}
                                    </span>
                                    <span className="truncate">{line.name}</span>
                                    <span className="text-right font-medium tabular-nums">{signed(group, line.amount)}</span>
                                </li>
                            ))}
                        </ul>
                    </Collapsible>
                ))}
            </div>
        </div>
    );
}

/** Sección que se abre y cierra animando su altura. */
function Collapsible({ summary, className, children }: { summary: ReactNode; className?: string; children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const contentId = useId();
    const reduceMotion = useReducedMotion();

    return (
        <div className={className}>
            <button
                type="button"
                aria-expanded={open}
                aria-controls={contentId}
                onClick={() => setOpen((current) => !current)}
                className="flex w-full cursor-pointer items-center gap-1.5 text-left"
            >
                <ChevronRight
                    className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                />
                {summary}
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        id={contentId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function BreakdownItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-lg bg-background/70 px-3 py-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
        </div>
    );
}
