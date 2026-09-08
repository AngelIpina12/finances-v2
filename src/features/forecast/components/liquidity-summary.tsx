"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import {
    AlertTriangle, ArrowDown, ArrowUp,
    CreditCard
} from "lucide-react";
import type { LiquidityRangeSummary } from "../domain/liquidity-calculator";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency", currency, maximumFractionDigits: 2,
    }).format(value);
}

export function LiquiditySummary({ summaries }: { summaries: LiquidityRangeSummary[] }) {
    if (!summaries.length) return null;

    return (
        <section className="space-y-4">
            {summaries.map((summary) => (
                <motion.div
                    key={summary.currency}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"
                >
                    <article className="rounded-2xl border bg-primary p-5 text-primary-foreground shadow-sm md:col-span-2 xl:col-span-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-foreground/70">
                            Liquidez final · {summary.currency}
                        </p>
                        <p className="mt-3 font-serif text-3xl tracking-[-0.04em]">
                            {money(summary.ending, summary.currency)}
                        </p>
                        <div className="mt-4 space-y-1 text-xs text-primary-foreground/80">
                            <p>Hoy: {money(summary.today, summary.currency)}</p>
                            <p>Inicio del rango: {money(summary.starting, summary.currency)}</p>
                            <p>Mínimo: {money(summary.minimum, summary.currency)}</p>
                        </div>
                    </article>
                    <SummaryCard
                        icon={ArrowUp}
                        label="Ingresos previstos"
                        value={summary.incomes}
                        currency={summary.currency}
                        tone="positive"
                    />
                    <SummaryCard
                        icon={ArrowDown}
                        label="Gastos directos"
                        value={summary.directExpenses}
                        currency={summary.currency}
                    />
                    <SummaryCard
                        icon={CreditCard}
                        label="Pagos de tarjetas"
                        value={summary.cardPayments}
                        currency={summary.currency}
                    />
                    <SummaryCard
                        icon={ArrowDown}
                        label="Cuotas financiadas"
                        value={summary.financingPayments}
                        currency={summary.currency}
                    />
                    {summary.firstNegativeAt && (
                        <p className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm md:col-span-2 xl:col-span-5">
                            <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                            La liquidez consolidada de {summary.currency} sería negativa por primera vez el {format(summary.firstNegativeAt, "d 'de' MMMM 'de' yyyy", { locale: es })}.
                        </p>
                    )}
                </motion.div>
            ))}
        </section>
    );
}

function SummaryCard({
    icon: Icon, label, value, currency, tone = "negative",
}: {
    icon: typeof ArrowUp;
    label: string;
    value: number;
    currency: string;
    tone?: "positive" | "negative";
}) {
    return (
        <article className="rounded-2xl border bg-card p-5 shadow-sm">
            <span className={tone === "positive"
                ? "grid size-9 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"
                : "grid size-9 place-items-center rounded-xl bg-rose-500/10 text-rose-600"
            }>
                <Icon className="size-4" />
            </span>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {label}
            </p>
            <p className="mt-2 text-xl font-semibold">{money(value, currency)}</p>
        </article>
    );
}
