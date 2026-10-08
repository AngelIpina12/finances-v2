"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatAppDate } from "@/src/shared/utils/local-date-time";
import type { LiquidityRangeSummary } from "../domain/liquidity-calculator";
import {
    TONE_TEXT, formatMoney, formatSignedMoney,
    toneOf
} from "./forecast-ui";

export type CardDebtSummary = {
    currency: string;
    today: number;
    projected: number;
    cards: number;
};

interface Props {
    liquidity: LiquidityRangeSummary[];
    debts: CardDebtSummary[];
    startsAt: Date;
}

function shortDate(date: Date) {
    return formatAppDate(date, { day: "numeric", month: "short" });
}

export function ForecastKeyFigures({ liquidity, debts, startsAt }: Props) {
    const currencies = [...new Set([...liquidity.map((item) => item.currency), ...debts.map((item) => item.currency)])];
    if (!currencies.length) return null;

    return (
        <section className="space-y-3">
            {currencies.map((currency) => {
                const summary = liquidity.find((item) => item.currency === currency);
                const debt = debts.find((item) => item.currency === currency);
                const suffix = currencies.length > 1 ? ` · ${currency}` : "";
                const outflows = summary
                    ? summary.directExpenses + summary.cardPayments + summary.financingPayments
                    : 0;

                return (
                    <div key={currency} className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-2">
                        {summary && (
                            <>
                                <Figure
                                    index={0}
                                    label={`Disponible al cierre${suffix}`}
                                    value={formatMoney(summary.ending, currency)}
                                    valueClassName={summary.ending < 0 ? TONE_TEXT.negative : undefined}
                                    detail={(
                                        <>
                                            <span className={TONE_TEXT[toneOf(summary.ending - summary.starting)]}>
                                                {formatSignedMoney(summary.ending - summary.starting, currency)}
                                            </span>
                                            {" "}desde {summary.starting === summary.today ? "hoy" : `el ${shortDate(startsAt)}`}
                                        </>
                                    )}
                                />
                                <Figure
                                    index={1}
                                    label="Punto más bajo"
                                    value={formatMoney(summary.minimum, currency)}
                                    valueClassName={summary.minimum < 0 ? TONE_TEXT.negative : undefined}
                                    detail={summary.minimum === summary.starting
                                        ? "No baja del saldo inicial"
                                        : `El ${formatAppDate(summary.minimumAt, { weekday: "short", day: "numeric", month: "short" })}`}
                                />
                                <Figure
                                    index={2}
                                    label="Entradas y salidas"
                                    value={(
                                        <span className="flex flex-col text-lg leading-tight xl:text-base">
                                            <span className={TONE_TEXT.positive}>+{formatMoney(summary.incomes, currency)}</span>
                                            <span className={TONE_TEXT.negative}>−{formatMoney(outflows, currency)}</span>
                                        </span>
                                    )}
                                    detail={[
                                        summary.cardPayments > 0 ? `Tarjetas ${formatMoney(summary.cardPayments, currency)}` : null,
                                        summary.financingPayments > 0 ? `Cuotas ${formatMoney(summary.financingPayments, currency)}` : null,
                                    ].filter(Boolean).join(" · ") || "Sin pagos de tarjetas ni cuotas"}
                                />
                            </>
                        )}
                        {debt && (
                            <Figure
                                index={3}
                                label={`Deuda de tarjetas${summary ? "" : suffix}`}
                                value={formatMoney(debt.projected, currency)}
                                detail={(
                                    <>
                                        <span className={TONE_TEXT[toneOf(debt.projected - debt.today, { inverted: true })]}>
                                            {formatSignedMoney(debt.projected - debt.today, currency)}
                                        </span>
                                        {" "}vs. hoy · {debt.cards} tarjeta{debt.cards === 1 ? "" : "s"}
                                    </>
                                )}
                            />
                        )}
                    </div>
                );
            })}
        </section>
    );
}

function Figure({ index, label, value, valueClassName, detail }: {
    index: number;
    label: string;
    value: ReactNode;
    valueClassName?: string;
    detail: ReactNode;
}) {
    return (
        <motion.article
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className="flex min-w-0 flex-col rounded-2xl border bg-card p-4"
        >
            <p className="truncate text-xs text-muted-foreground">{label}</p>
            <div className={cn("mt-1.5 truncate text-2xl font-semibold tracking-tight tabular-nums xl:text-xl", valueClassName)}>
                {value}
            </div>
            <p className="mt-auto pt-2 text-xs text-muted-foreground tabular-nums">{detail}</p>
        </motion.article>
    );
}
