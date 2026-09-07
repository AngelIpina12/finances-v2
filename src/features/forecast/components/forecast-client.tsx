"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import {
    AlertTriangle, CalendarClock, ChevronRight,
    Landmark, ReceiptText, Repeat2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/src/shared/components/ui/card";
import { buildCashFlow, buildForecast } from "../domain/forecast-calculator";
import type { ForecastData } from "../queries/get-forecast-data";

type Horizon = 30 | 60 | 90;

const horizons: Array<{ value: Horizon; label: string }> = [
    { value: 30, label: "30 días" },
    { value: 60, label: "60 días" },
    { value: 90, label: "90 días" },
];

function money(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency", currency, maximumFractionDigits: 2,
    }).format(value);
}

function eventIcon(source: ForecastData["events"][number]["source"]) {
    return source === "recurring" ? Repeat2 : source === "financing" ? Landmark : ReceiptText;
}

export function ForecastClient({ accounts, events, now }: ForecastData) {
    const [horizon, setHorizon] = useState<Horizon>(30);
    const [accountId, setAccountId] = useState<string>("all");
    const [cashFlowPeriod, setCashFlowPeriod] = useState<"week" | "month">("week");
    const forecast = useMemo(
        () => buildForecast({ accounts, events, now: new Date(now), days: horizon }),
        [accounts, events, horizon, now],
    );
    const visibleEvents = forecast.events.filter((event) => (
        accountId === "all" || event.accountId === accountId
    ));
    const visibleAccounts = forecast.accounts.filter((account) => (
        accountId === "all" || account.id === accountId
    ));
    const visibleAlerts = forecast.alerts.filter((alert) => (
        accountId === "all" || alert.accountId === accountId
    ));
    const selectedAccount = accounts.find((account) => account.id === accountId);
    const cashFlow = selectedAccount
        ? buildCashFlow(
            visibleEvents.filter((event) => event.currency === selectedAccount.currency),
            cashFlowPeriod,
        )
        : [];

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
                        Mira hacia adelante
                    </p>
                    <CardTitle className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">
                        Previsión
                    </CardTitle>
                    <p className="max-w-2xl text-muted-foreground">
                        Una estimación basada en tus movimientos programados, recurrencias y cuotas pendientes.
                    </p>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {horizons.map((item) => (
                        <Button
                            key={item.value}
                            type="button"
                            size="sm"
                            variant={horizon === item.value ? "default" : "outline"}
                            onClick={() => setHorizon(item.value)}
                            className="shrink-0 cursor-pointer"
                        >
                            {item.label}
                        </Button>
                    ))}
                </div>
            </motion.header>

            {!accounts.length ? (
                <EmptyState />
            ) : (
                <>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        <Button
                            type="button"
                            size="sm"
                            variant={accountId === "all" ? "default" : "outline"}
                            onClick={() => setAccountId("all")}
                            className="shrink-0 cursor-pointer"
                        >
                            Todas las cuentas
                        </Button>
                        {accounts.map((account) => (
                            <Button
                                key={account.id}
                                type="button"
                                size="sm"
                                variant={accountId === account.id ? "default" : "outline"}
                                onClick={() => setAccountId(account.id)}
                                className="shrink-0 cursor-pointer"
                            >
                                {account.name} · {account.currency}
                            </Button>
                        ))}
                    </div>

                    {visibleAlerts.length > 0 && (
                        <section className="space-y-3">
                            {visibleAlerts.map((alert, index) => {
                                const account = accounts.find((item) => item.id === alert.accountId);

                                return (
                                    <motion.article
                                        key={`${alert.accountId}-${alert.scheduledAt.toISOString()}-${index}`}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm"
                                    >
                                        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                                        <p>
                                            <span className="font-semibold">{account?.name}: </span>
                                            {alert.kind === "credit_limit"
                                                ? `la deuda proyectada excedería el límite por ${money(alert.amount, account?.currency ?? "MXN")}`
                                                : `podrías quedarte sin saldo; faltarían ${money(alert.amount, account?.currency ?? "MXN")}`
                                            } el {format(alert.scheduledAt, "d 'de' MMMM", { locale: es })}.
                                        </p>
                                    </motion.article>
                                );
                            })}
                        </section>
                    )}

                    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {visibleAccounts.map((account, index) => {
                            const hasAlert = visibleAlerts.some((alert) => alert.accountId === account.id);
                            const isCredit = account.type === "credit";

                            return (
                                <motion.article
                                    key={account.id}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.04 }}
                                    className="rounded-2xl border bg-card p-5 shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold">{account.name}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {isCredit ? "Deuda proyectada" : "Saldo proyectado"} · {account.currency}
                                            </p>
                                        </div>
                                        {hasAlert && <AlertTriangle className="size-5 text-amber-600" />}
                                    </div>
                                    <p className={isCredit ? "mt-5 text-2xl font-semibold" : "mt-5 text-2xl font-semibold"}>
                                        {money(account.projectedBalance, account.currency)}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Hoy: {money(account.currentBalance, account.currency)}
                                        {isCredit && account.creditLimit !== null
                                            ? ` · Límite: ${money(account.creditLimit, account.currency)}`
                                            : ""
                                        }
                                    </p>
                                </motion.article>
                            );
                        })}
                    </section>

                    <section className="overflow-hidden rounded-2xl border bg-card">
                        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="font-serif text-2xl tracking-[-0.03em]">Flujo de efectivo</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {selectedAccount
                                        ? `Ingresos y gastos previstos en ${selectedAccount.name}.`
                                        : "Selecciona una cuenta para no mezclar monedas ni saldos."
                                    }
                                </p>
                            </div>
                            {selectedAccount && (
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={cashFlowPeriod === "week" ? "default" : "outline"}
                                        onClick={() => setCashFlowPeriod("week")}
                                        className="cursor-pointer"
                                    >
                                        Semanal
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={cashFlowPeriod === "month" ? "default" : "outline"}
                                        onClick={() => setCashFlowPeriod("month")}
                                        className="cursor-pointer"
                                    >
                                        Mensual
                                    </Button>
                                </div>
                            )}
                        </div>
                        {selectedAccount && (
                            <div className="divide-y">
                                {cashFlow.length ? cashFlow.map((period) => (
                                    <article
                                        key={period.label}
                                        className="grid gap-3 p-4 text-sm sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-6 sm:p-5"
                                    >
                                        <p className="font-medium capitalize">{period.label}</p>
                                        <p className="text-emerald-600">+{money(period.incomes, selectedAccount.currency)}</p>
                                        <p>-{money(period.expenses, selectedAccount.currency)}</p>
                                        <p className={period.net >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-destructive"}>
                                            {period.net >= 0 ? "+" : ""}{money(period.net, selectedAccount.currency)}
                                        </p>
                                    </article>
                                )) : (
                                    <p className="p-5 text-sm text-muted-foreground">
                                        No hay flujo previsto para esta cuenta en el horizonte elegido.
                                    </p>
                                )}
                            </div>
                        )}
                    </section>

                    <section className="overflow-hidden rounded-2xl border bg-card">
                        <div className="flex items-center justify-between gap-4 border-b p-5">
                            <div>
                                <h2 className="font-serif text-2xl tracking-[-0.03em]">Línea de tiempo</h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {visibleEvents.length
                                        ? `${visibleEvents.length} compromiso${visibleEvents.length === 1 ? "" : "s"} en los próximos ${horizon} días.`
                                        : "No hay movimientos previstos en este horizonte."
                                    }
                                </p>
                            </div>
                            <CalendarClock className="size-5 text-muted-foreground" />
                        </div>
                        {visibleEvents.length > 0 && (
                            <div className="divide-y">
                                {visibleEvents.map((event) => {
                                    const Icon = eventIcon(event.source);
                                    const isIncome = event.transactionType === "income";
                                    const account = event.accountId
                                        ? accounts.find((item) => item.id === event.accountId)
                                        : null;

                                    return (
                                        <article key={event.id} className="flex items-center gap-3 p-4 sm:p-5">
                                            <span className={isIncome
                                                ? "grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"
                                                : "grid size-10 shrink-0 place-items-center rounded-xl bg-rose-500/10 text-rose-600"
                                            }>
                                                <Icon className="size-4" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold">{event.name}</p>
                                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                    {format(event.scheduledAt, "EEE d 'de' MMM · HH:mm", { locale: es })}
                                                    {event.source === "recurring"
                                                        ? " · Recurrencia"
                                                        : event.source === "financing"
                                                            ? " · Cuota por cubrir"
                                                            : account ? ` · ${account.name}` : ""
                                                    }
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className={isIncome
                                                    ? "text-sm font-semibold text-emerald-600"
                                                    : "text-sm font-semibold"
                                                }>
                                                    {isIncome ? "+" : "-"}{money(event.amount, event.currency)}
                                                </p>
                                                <p className="mt-0.5 text-xs text-muted-foreground">
                                                    {event.balanceAfter === null
                                                        ? "Cuenta de pago por definir"
                                                        : `${account?.type === "credit" ? "Deuda" : "Saldo"}: ${money(event.balanceAfter, event.currency)}`
                                                    }
                                                </p>
                                            </div>
                                            <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                        Esta previsión es informativa: no crea movimientos ni modifica saldos. Las cuotas de financiamiento aparecen como compromisos porque la cuenta desde la que pagarás se elige al registrarlas.
                    </p>
                </>
            )}
        </div>
    );
}

function EmptyState() {
    return (
        <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid min-h-80 place-items-center rounded-2xl border border-dashed bg-muted/25 p-8 text-center"
        >
            <div className="max-w-md">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                    <CalendarClock />
                </span>
                <h2 className="mt-5 text-xl font-semibold">Primero agrega una cuenta</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                    La previsión parte de tus saldos actuales para estimar lo que viene.
                </p>
            </div>
        </motion.section>
    );
}
