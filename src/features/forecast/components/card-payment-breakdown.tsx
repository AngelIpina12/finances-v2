"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ProjectedForecastEvent } from "../domain/forecast-calculator";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency", currency, maximumFractionDigits: 2,
    }).format(value);
}

export function CardPaymentBreakdown({ event }: { event: ProjectedForecastEvent }) {
    const breakdown = event.cardPaymentBreakdown;
    if (!breakdown) return null;

    return (
        <details className="mt-3 rounded-xl bg-muted/60 p-3 text-xs">
            <summary className="cursor-pointer font-semibold">Ver cálculo del pago</summary>
            <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {breakdown.closesAt && (
                    <BreakdownItem
                        label="Corte asociado"
                        value={format(breakdown.closesAt, "d 'de' MMMM 'de' yyyy", { locale: es })}
                    />
                )}
                {breakdown.statementBalance > 0 && (
                    <BreakdownItem label="Estado informado" value={money(breakdown.statementBalance, event.currency)} />
                )}
                {breakdown.trackedInstallments > 0 && (
                    <BreakdownItem label="Cuotas rastreadas aparte" value={money(breakdown.trackedInstallments, event.currency)} />
                )}
                {breakdown.untrackedStatement > 0 && (
                    <BreakdownItem label="Componente no rastreado" value={money(breakdown.untrackedStatement, event.currency)} />
                )}
                {breakdown.projectedCharges > 0 && (
                    <BreakdownItem label="Cargos previstos del ciclo" value={money(breakdown.projectedCharges, event.currency)} />
                )}
                <BreakdownItem
                    label="Pago esperado"
                    value={breakdown.expectedPayment === null
                        ? "Por confirmar manualmente"
                        : money(breakdown.expectedPayment, event.currency)
                    }
                />
            </dl>
        </details>
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
