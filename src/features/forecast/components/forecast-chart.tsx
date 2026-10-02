"use client";

import { useId } from "react";
import {
    Area, CartesianGrid, ComposedChart,
    Line, ReferenceLine, XAxis,
    YAxis,
} from "recharts";
import {
    ChartContainer, ChartTooltip, type ChartConfig
} from "@/components/ui/chart";
import { SegmentedControl } from "@/src/shared/components/forms";
import type { LinkedSavingsMode } from "../domain/linked-savings";
import type { ForecastTimelineMeasure, ForecastTimelinePoint } from "../domain/forecast-timeline";

export type ForecastChartView = "balance" | "flows" | "savings";

export type ForecastSavingsPoint = Pick<ForecastTimelinePoint, "key" | "label" | "tooltipLabel">
    & Record<LinkedSavingsMode, number>
    & {
        sweep?: number;
        changes: Partial<Record<LinkedSavingsMode | "sweep", number | null>>;
    };

type ChartPoint = {
    key: string;
    label: string;
    tooltipLabel: string;
    changes?: Partial<Record<string, number | null>>;
    period?: { incomes: number; expenses: number };
} & Record<string, unknown>;

type Series = {
    key: string;
    label: string;
    color: string;
    dashed?: boolean;
};

const measureLabels: Record<ForecastTimelineMeasure, string> = {
    balance: "Saldo proyectado",
    debt: "Deuda proyectada",
};

const viewDescriptions: Record<ForecastChartView, string> = {
    balance: "Cómo cierra cada periodo, con sus altas y bajas.",
    flows: "Lo que entra y sale acumulado desde el inicio del rango; la separación entre líneas es lo que te queda.",
    savings: "El mismo saldo según cómo se contemplen tus cajitas.",
};

interface Props {
    view: ForecastChartView;
    onViewChange: (view: ForecastChartView) => void;
    hasSavings: boolean;
    measure: ForecastTimelineMeasure;
    points: ForecastTimelinePoint[];
    savingsPoints: ForecastSavingsPoint[] | null;
    currency: string | null;
    emptyMessage: string | null;
}

function formatMoney(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency", currency, maximumFractionDigits: 2,
    }).format(value);
}

function formatAxisMoney(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency", currency, notation: "compact", maximumFractionDigits: 1,
    }).format(value);
}

function getSeries(view: ForecastChartView, measure: ForecastTimelineMeasure, hasSweep: boolean): Series[] {
    if (view === "flows") {
        const isDebt = measure === "debt";
        return [
            { key: "incomes", label: isDebt ? "Pagos acumulados" : "Ingresos acumulados", color: "var(--chart-1)" },
            { key: "expenses", label: isDebt ? "Cargos acumulados" : "Gastos acumulados", color: "var(--chart-5)", dashed: true },
        ];
    }

    if (view === "savings") {
        return [
            ...(hasSweep ? [{ key: "sweep", label: "Con ahorro automático", color: "var(--chart-4)" }] : []),
            { key: "with_yield", label: "Con cajitas y rendimiento", color: "var(--chart-2)" },
            { key: "principal", label: "Con cajitas", color: "var(--chart-3)", dashed: true },
            { key: "exclude", label: "Sin cajitas", color: "var(--muted-foreground)", dashed: true },
        ];
    }

    return [{ key: "balance", label: measureLabels[measure], color: "var(--chart-2)" }];
}

export function ForecastChart({ view, onViewChange, hasSavings, measure, points, savingsPoints, currency, emptyMessage }: Props) {
    const gradientId = useId().replace(/:/g, "");
    const activeView = view === "savings" && !savingsPoints ? "balance" : view;
    const series = getSeries(activeView, measure, savingsPoints?.[0]?.sweep !== undefined);
    const data: ChartPoint[] = activeView === "savings"
        ? savingsPoints ?? []
        : points.map((point) => ({
            ...point,
            changes: { balance: point.balanceChange },
            period: { incomes: point.periodIncomes, expenses: point.periodExpenses },
        }));
    const config = Object.fromEntries(series.map((item) => [
        item.key, { label: item.label, color: item.color },
    ])) satisfies ChartConfig;
    const views = hasSavings ? ["balance", "flows", "savings"] as const : ["balance", "flows"] as const;

    const balances = activeView === "balance" ? points.map((point) => point.balance) : [];
    const highest = Math.max(0, ...balances);
    const lowest = Math.min(0, ...balances);
    const showsNegative = activeView === "balance" && measure !== "debt" && lowest < 0;
    const zeroOffset = highest === lowest ? 1 : highest / (highest - lowest);
    const showsZeroLine = activeView !== "flows" && measure !== "debt";

    return (
        <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <h2 className="font-serif text-2xl tracking-[-0.03em]">
                        {activeView === "flows"
                            ? measure === "debt" ? "Cargos contra pagos" : "Ingresos contra gastos"
                            : activeView === "savings" ? "Saldo con y sin cajitas" : measureLabels[measure]}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {viewDescriptions[activeView]}{" "}
                        {measure === "debt"
                            ? "Muestra la deuda de las tarjetas filtradas."
                            : "Considera sólo tu dinero; no resta la deuda de tarjetas."}
                    </p>
                </div>
                <SegmentedControl
                    items={views}
                    labels={{ balance: "Saldo", flows: "Ingresos vs gastos", savings: "Cajitas" }}
                    value={activeView}
                    onChange={onViewChange}
                    className="mb-0 w-full shrink-0 lg:w-auto [&>button]:whitespace-nowrap"
                />
            </div>

            {emptyMessage || !currency ? (
                <p className="mt-6 grid h-64 place-items-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">
                    {emptyMessage ?? "Elige una moneda para graficar sin mezclar saldos."}
                </p>
            ) : (
                <>
                    {series.length > 1 && (
                        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {series.map((item) => (
                                <span key={item.key} className="flex items-center gap-1.5">
                                    <span
                                        className="w-4 border-t-2"
                                        style={{ borderColor: item.color, borderStyle: item.dashed ? "dashed" : "solid" }}
                                    />
                                    {item.label}
                                </span>
                            ))}
                        </div>
                    )}
                    <ChartContainer config={config} className="mt-4 aspect-auto h-72 w-full">
                        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                            <defs>
                                <linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={zeroOffset} stopColor="var(--color-balance)" />
                                    <stop offset={zeroOffset} stopColor={showsNegative ? "var(--destructive)" : "var(--color-balance)"} />
                                </linearGradient>
                                <linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={0} stopColor="var(--color-balance)" stopOpacity={0.2} />
                                    <stop offset={zeroOffset} stopColor="var(--color-balance)" stopOpacity={0.04} />
                                    <stop offset={zeroOffset} stopColor={showsNegative ? "var(--destructive)" : "var(--color-balance)"} stopOpacity={0.04} />
                                    <stop offset={1} stopColor={showsNegative ? "var(--destructive)" : "var(--color-balance)"} stopOpacity={0.2} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="label"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                minTickGap={24}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                width={72}
                                tickFormatter={(value: number) => formatAxisMoney(value, currency)}
                            />
                            {showsZeroLine && (
                                <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity={0.6} />
                            )}
                            <ChartTooltip
                                cursor={{ strokeDasharray: "4 4" }}
                                content={({ active, payload }) => (
                                    <ForecastTooltip
                                        active={active}
                                        point={payload?.[0]?.payload as ChartPoint | undefined}
                                        series={series}
                                        currency={currency}
                                        showsPeriodFlows={activeView === "flows"}
                                        isDebt={measure === "debt"}
                                    />
                                )}
                            />
                            {activeView === "balance" ? (
                                <Area
                                    dataKey="balance"
                                    type="monotone"
                                    baseValue={0}
                                    stroke={`url(#${gradientId}-stroke)`}
                                    strokeWidth={2}
                                    fill={`url(#${gradientId}-fill)`}
                                    activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            ) : series.map((item) => (
                                <Line
                                    key={item.key}
                                    dataKey={item.key}
                                    type="monotone"
                                    stroke={`var(--color-${item.key})`}
                                    strokeWidth={2}
                                    strokeDasharray={item.dashed ? "6 4" : undefined}
                                    dot={false}
                                    activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)", fill: `var(--color-${item.key})` }}
                                    isAnimationActive={false}
                                />
                            ))}
                        </ComposedChart>
                    </ChartContainer>
                    <table className="sr-only">
                        <caption>Datos de la gráfica</caption>
                        <thead>
                            <tr>
                                <th>Periodo</th>
                                {series.map((item) => <th key={item.key}>{item.label}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((point) => (
                                <tr key={point.key}>
                                    <td>{point.tooltipLabel}</td>
                                    {series.map((item) => (
                                        <td key={item.key}>{formatMoney(Number(point[item.key]), currency)}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </section>
    );
}

function formatChange(value: number, currency: string) {
    return `${value > 0 ? "+" : ""}${formatMoney(value, currency)}`;
}

function TooltipRow({ label, value, currency }: { label: string; value: number; currency: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-mono font-medium tabular-nums">{formatMoney(value, currency)}</span>
        </div>
    );
}

function ForecastTooltip({ active, point, series, currency, showsPeriodFlows, isDebt }: {
    active?: boolean;
    point: ChartPoint | undefined;
    series: Series[];
    currency: string;
    showsPeriodFlows: boolean;
    isDebt: boolean;
}) {
    if (!active || !point) return null;

    return (
        <div className="grid min-w-52 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
            <p className="font-medium">{point.tooltipLabel}</p>
            {series.map((item) => {
                const change = point.changes?.[item.key];
                return (
                    <div key={item.key} className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-xs" style={{ backgroundColor: item.color }} />
                        <span className="flex-1 text-muted-foreground">{item.label}</span>
                        <span className="font-mono font-medium tabular-nums">
                            {formatMoney(Number(point[item.key]), currency)}
                        </span>
                        {change != null && (
                            <span className="font-mono tabular-nums text-muted-foreground">
                                ({formatChange(change, currency)})
                            </span>
                        )}
                    </div>
                );
            })}
            {showsPeriodFlows && (
                <>
                    <TooltipRow label="Diferencia" value={Number(point.incomes) - Number(point.expenses)} currency={currency} />
                    {point.period && point.key !== "start" && (
                        <div className="grid gap-1.5 border-t pt-1.5">
                            <p className="font-medium text-muted-foreground">En este periodo</p>
                            <TooltipRow label={isDebt ? "Pagos" : "Ingresos"} value={point.period.incomes} currency={currency} />
                            <TooltipRow label={isDebt ? "Cargos" : "Gastos"} value={point.period.expenses} currency={currency} />
                            <TooltipRow label="Neto" value={point.period.incomes - point.period.expenses} currency={currency} />
                        </div>
                    )}
                </>
            )}
            {!showsPeriodFlows && series.some((item) => point.changes?.[item.key] != null) && (
                <p className="border-t pt-1.5 text-muted-foreground">Entre paréntesis: cambio en el periodo.</p>
            )}
        </div>
    );
}
