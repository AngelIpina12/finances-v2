"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";
import {
    AlertTriangle, CalendarClock, ChevronRight,
    CreditCard, Landmark, ReceiptText, Repeat2, Settings2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CreditCardPaymentSettingsForm } from "@/src/features/accounts/components/credit-card-payment-settings-form";
import { CardTitle } from "@/src/shared/components/ui/card";
import {
    addAppCalendarDays, toAppDateInputValue,
} from "@/src/shared/utils/local-date-time";
import { CardPaymentBreakdown } from "./card-payment-breakdown";
import { ForecastControls } from "./forecast-controls";
import { LiquiditySummary } from "./liquidity-summary";
import {
    buildCashFlow, buildCreditDebtActivity,
    buildForecast, type ForecastEventSource, type ForecastGranularity,
} from "../domain/forecast-calculator";
import { buildLiquidityRangeSummaries } from "../domain/liquidity-calculator";
import type { ForecastData } from "../queries/get-forecast-data";
import { fromForecastDateInput, isInsideForecastRange } from "../utils/forecast-filters";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency", currency, maximumFractionDigits: 2,
    }).format(value);
}

function eventIcon(source: ForecastEventSource) {
    return source === "recurring"
        ? Repeat2
        : source === "financing"
            ? Landmark
            : source === "card_payment"
                ? CreditCard
                : ReceiptText;
}

export function ForecastClient({ accounts, cardPaymentSettings, events, now }: ForecastData) {
    const router = useRouter();
    const anchorNow = useMemo(() => new Date(now), [now]);
    const minimumDate = toAppDateInputValue(anchorNow);
    const maximumDate = toAppDateInputValue(addAppCalendarDays(anchorNow, 180));
    const [startsAtValue, setStartsAtValue] = useState(minimumDate);
    const [endsAtValue, setEndsAtValue] = useState(
        toAppDateInputValue(addAppCalendarDays(anchorNow, 30)),
    );
    const [activePreset, setActivePreset] = useState<number | null>(30);
    const [currency, setCurrency] = useState<string>("all");
    const [accountId, setAccountId] = useState<string>("all");
    const [granularity, setGranularity] = useState<ForecastGranularity>("week");
    const [cardToConfigure, setCardToConfigure] = useState<ForecastData["accounts"][number] | null>(null);
    const startsAt = fromForecastDateInput(startsAtValue) ?? anchorNow;
    const endsAt = fromForecastDateInput(endsAtValue) ?? addAppCalendarDays(anchorNow, 30);
    const forecastDays = Math.min(180, Math.max(
        1,
        Math.ceil((endsAt.getTime() - anchorNow.getTime()) / (24 * 60 * 60 * 1000)),
    ));
    const currencies = [...new Set(accounts.map((account) => account.currency))];
    const forecast = useMemo(
        () => buildForecast({
            accounts,
            events,
            settings: cardPaymentSettings,
            now: anchorNow,
            days: forecastDays,
        }),
        [accounts, cardPaymentSettings, events, anchorNow, forecastDays],
    );
    const visibleEvents = forecast.events.filter((event) => (
        isInsideForecastRange(event.scheduledAt, startsAt, endsAt)
        && (currency === "all" || event.currency === currency)
        && (accountId === "all" || event.accountId === accountId || event.settlesAccountId === accountId)
    ));
    const visibleAccounts = forecast.accounts.filter((account) => (
        (currency === "all" || account.currency === currency)
        && (accountId === "all" || account.id === accountId)
    ));
    const visibleAlerts = forecast.alerts.filter((alert) => (
        isInsideForecastRange(alert.scheduledAt, startsAt, endsAt)
        && (accountId === "all" || alert.accountId === accountId)
        && (currency === "all" || accounts.find((account) => account.id === alert.accountId)?.currency === currency)
    ));
    const selectedAccount = accounts.find((account) => account.id === accountId);
    const isSelectedCredit = selectedAccount?.type === "credit";
    const cashFlow = selectedAccount
        ? buildCashFlow(
            visibleEvents.filter((event) => event.currency === selectedAccount.currency),
            granularity,
        )
        : [];
    const debtActivity = isSelectedCredit
        ? buildCreditDebtActivity(visibleEvents, selectedAccount.id, granularity)
        : [];
    const liquiditySummaries = buildLiquidityRangeSummaries({
        accounts,
        events: forecast.events,
        startsAt,
        endsAt,
        currency: currency === "all" ? undefined : currency as ForecastData["accounts"][number]["currency"],
    });

    function selectPreset(days: number) {
        setStartsAtValue(minimumDate);
        setEndsAtValue(toAppDateInputValue(addAppCalendarDays(anchorNow, days)));
        setActivePreset(days);
    }

    function selectCurrency(value: string) {
        setCurrency(value);
        if (value !== "all" && selectedAccount?.currency !== value) setAccountId("all");
    }

    function selectStartsAt(value: string) {
        setStartsAtValue(value);
        setActivePreset(null);

        const nextStart = fromForecastDateInput(value);
        if (nextStart && nextStart >= endsAt) {
            setEndsAtValue(toAppDateInputValue(addAppCalendarDays(nextStart, 1)));
        }
    }

    return (
        <div className="space-y-7">
            <motion.header
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-4"
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
            </motion.header>

            <ForecastControls
                startsAt={startsAtValue}
                endsAt={endsAtValue}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                currency={currency}
                currencies={currencies}
                granularity={granularity}
                activePreset={activePreset}
                onStartsAtChange={selectStartsAt}
                onEndsAtChange={(value) => {
                    setEndsAtValue(value);
                    setActivePreset(null);
                }}
                onCurrencyChange={selectCurrency}
                onGranularityChange={setGranularity}
                onPresetChange={selectPreset}
            />

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
                        {accounts
                            .filter((account) => currency === "all" || account.currency === currency)
                            .map((account) => (
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
                                            {alert.kind === "overdue_payment"
                                                ? `hay un pago vencido por ${money(alert.amount, account?.currency ?? "MXN")} que se considera exigible desde hoy.`
                                                : <>
                                                    {alert.kind === "credit_limit"
                                                        ? `la deuda proyectada excedería el límite por ${money(alert.amount, account?.currency ?? "MXN")}`
                                                        : `podrías quedarte sin saldo; faltarían ${money(alert.amount, account?.currency ?? "MXN")}`
                                                    } el {format(alert.scheduledAt, "d 'de' MMMM", { locale: es })}.
                                                </>
                                            }
                                        </p>
                                    </motion.article>
                                );
                            })}
                        </section>
                    )}

                    {accountId === "all" && <LiquiditySummary summaries={liquiditySummaries} />}

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
                                    {isCredit && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCardToConfigure(account)}
                                            className="mt-4 cursor-pointer"
                                        >
                                            <Settings2 className="size-3.5" />
                                            Plan de pago
                                        </Button>
                                    )}
                                </motion.article>
                            );
                        })}
                    </section>

                    <section className="overflow-hidden rounded-2xl border bg-card">
                        <div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="font-serif text-2xl tracking-[-0.03em]">
                                    {isSelectedCredit ? "Actividad de deuda" : "Flujo de efectivo"}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {selectedAccount
                                        ? isSelectedCredit
                                            ? `Cargos y pagos que modifican la deuda de ${selectedAccount.name}.`
                                            : `Ingresos y gastos previstos en ${selectedAccount.name}.`
                                        : "Selecciona una cuenta para no mezclar monedas ni saldos."
                                    }
                                </p>
                            </div>
                            {selectedAccount && (
                                <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
                                    Agrupación: {granularity === "day" ? "diaria" : granularity === "week" ? "semanal" : "mensual"}
                                </span>
                            )}
                        </div>
                        {selectedAccount && (
                            <div className="hidden grid-cols-[minmax(0,1fr)_repeat(3,8rem)] gap-6 border-b px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:grid">
                                <span>Periodo</span>
                                <span className="text-right">{isSelectedCredit ? "Cargos" : "Ingresos"}</span>
                                <span className="text-right">{isSelectedCredit ? "Pagos" : "Gastos"}</span>
                                <span className="text-right">{isSelectedCredit ? "Variación" : "Neto"}</span>
                            </div>
                        )}
                        {selectedAccount && isSelectedCredit && (
                            <div className="divide-y">
                                {debtActivity.length ? debtActivity.map((period) => (
                                    <article
                                        key={period.label}
                                        className="grid gap-3 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_repeat(3,8rem)] sm:items-center sm:gap-6 sm:p-5"
                                    >
                                        <p className="font-medium capitalize">{period.label}</p>
                                        <p className="text-destructive sm:text-right">
                                            <span className="mr-1 text-xs text-muted-foreground sm:hidden">Cargos:</span>
                                            +{money(period.charges, selectedAccount.currency)}
                                        </p>
                                        <p className="text-emerald-600 sm:text-right">
                                            <span className="mr-1 text-xs text-muted-foreground sm:hidden">Pagos:</span>
                                            -{money(period.payments, selectedAccount.currency)}
                                        </p>
                                        <p className={period.netDebtChange > 0
                                            ? "font-semibold text-destructive sm:text-right"
                                            : period.netDebtChange < 0
                                                ? "font-semibold text-emerald-600 sm:text-right"
                                                : "font-semibold sm:text-right"
                                        }>
                                            <span className="mr-1 text-xs font-normal text-muted-foreground sm:hidden">Variación:</span>
                                            {period.netDebtChange > 0 ? "+" : ""}
                                            {money(period.netDebtChange, selectedAccount.currency)}
                                        </p>
                                    </article>
                                )) : (
                                    <p className="p-5 text-sm text-muted-foreground">
                                        No hay cargos ni pagos previstos para esta tarjeta en el horizonte elegido.
                                    </p>
                                )}
                            </div>
                        )}
                        {selectedAccount && !isSelectedCredit && (
                            <div className="divide-y">
                                {cashFlow.length ? cashFlow.map((period) => (
                                    <article
                                        key={period.label}
                                        className="grid gap-3 p-4 text-sm sm:grid-cols-[minmax(0,1fr)_repeat(3,8rem)] sm:items-center sm:gap-6 sm:p-5"
                                    >
                                        <p className="font-medium capitalize">{period.label}</p>
                                        <p className="text-emerald-600 sm:text-right">+{money(period.incomes, selectedAccount.currency)}</p>
                                        <p className="sm:text-right">-{money(period.expenses, selectedAccount.currency)}</p>
                                        <p className={period.net >= 0
                                            ? "font-semibold text-emerald-600 sm:text-right"
                                            : "font-semibold text-destructive sm:text-right"
                                        }>
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
                                        ? `${visibleEvents.length} compromiso${visibleEvents.length === 1 ? "" : "s"} entre ${format(startsAt, "d MMM", { locale: es })} y ${format(endsAt, "d MMM yyyy", { locale: es })}.`
                                        : "No hay movimientos previstos en el rango seleccionado."
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
                                    const settledAccount = event.settlesAccountId
                                        ? accounts.find((item) => item.id === event.settlesAccountId)
                                        : null;
                                    const balanceDescription = event.balanceAfter === null
                                        ? event.source === "card_payment"
                                            ? "Pago manual por confirmar"
                                            : "Cuenta de pago por definir"
                                        : [
                                            `${account?.type === "credit" ? "Deuda" : "Saldo"} ${account?.name ?? ""}: ${money(event.balanceAfter, event.currency)}`,
                                            settledAccount && event.settledBalanceAfter !== null
                                                ? `Deuda ${settledAccount.name}: ${money(event.settledBalanceAfter, event.currency)}`
                                                : null,
                                        ].filter(Boolean).join(" · ");

                                    return (
                                        <article key={event.id} className="p-4 sm:p-5">
                                            <div className="flex items-center gap-3">
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
                                                                : event.source === "card_payment"
                                                                    ? event.affectsBalance
                                                                        ? " · Pago proyectado de tarjeta"
                                                                        : " · Compromiso manual"
                                                                : account ? ` · ${account.name}` : ""
                                                        }
                                                        {event.isOverdue ? " · Vencido" : ""}
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
                                                        {balanceDescription}
                                                    </p>
                                                </div>
                                                {event.cardPaymentBreakdown && (
                                                    <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                                                )}
                                            </div>
                                            <CardPaymentBreakdown event={event} />
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                        Esta previsión es informativa: no crea movimientos ni modifica saldos. Los pagos de tarjeta se calculan desde el corte y los días naturales que configures.
                    </p>
                </>
            )}
            <Dialog
                open={cardToConfigure !== null}
                onOpenChange={(open) => !open && setCardToConfigure(null)}
            >
                <DialogContent
                    className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-none overflow-y-auto p-6 sm:w-[min(92vw,38rem)] sm:max-w-none"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <DialogTitle className="font-serif text-2xl">Plan de pago</DialogTitle>
                        <DialogDescription>
                            {cardToConfigure
                                ? `Define cómo proyectar el pago de ${cardToConfigure.name}.`
                                : ""
                            }
                        </DialogDescription>
                    </DialogHeader>
                    {cardToConfigure && (
                        <CreditCardPaymentSettingsForm
                            key={cardToConfigure.id}
                            card={cardToConfigure}
                            accounts={accounts}
                            setting={cardPaymentSettings.find((setting) => (
                                setting.creditAccountId === cardToConfigure.id
                            ))}
                            now={new Date(now)}
                            onClose={() => {
                                setCardToConfigure(null);
                                router.refresh();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
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
