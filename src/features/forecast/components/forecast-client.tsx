"use client";

import {
    useEffect, useMemo, useRef,
    useState, type ReactNode
} from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
    AlertTriangle, CalendarClock, ChevronRight,
    CreditCard, Landmark, PiggyBank,
    ReceiptText, Repeat2, Settings2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CreditCardPaymentSettingsForm } from "@/src/features/accounts/components/credit-card-payment-settings-form";
import { CardTitle } from "@/src/shared/components/ui/card";
import {
    addAppCalendarDays, formatAppDate, millisecondsUntilNextAppDay,
    toAppDateInputValue,
} from "@/src/shared/utils/local-date-time";
import { CardPaymentBreakdown } from "./card-payment-breakdown";
import { dismissCardPayment, restoreCardPayment } from "../actions/card-payment-dismissal-actions";
import { payCardStatement } from "../actions/card-statement-payment-actions";
import { InsufficientFundsDialog } from "@/src/features/transactions/components/insufficient-funds-dialog";
import type { FundsImpact } from "@/src/features/transactions/domain/transaction-rules";
import { ForecastControls } from "./forecast-controls";
import {
    ForecastAccountFilters, matchesAccountKind, type ForecastAccountKind,
} from "./forecast-account-filters";
import { LiquiditySummary } from "./liquidity-summary";
import {
    buildCashFlow, buildCreditDebtActivity, buildForecast,
    type ForecastEventSource, type ForecastGranularity,
} from "../domain/forecast-calculator";
import { buildLiquidityRangeSummaries } from "../domain/liquidity-calculator";
import {
    applyLinkedSavings, linkedSavingsAccountId, withSavingsAccounts,
    type LinkedSavingsMode,
} from "../domain/linked-savings";
import { applySavingsSweep, simulatedSavingsAccountId } from "../domain/savings-sweep";
import { ForecastSavingsSimulation, type SavingsSimulationDraft } from "./forecast-savings-simulation";
import { ForecastSavedViews } from "./forecast-saved-views";
import { resolveForecastViewRange, type SavedForecastView } from "../domain/forecast-view";
import {
    buildForecastTimeline, groupTimelineEvents, selectTimelineAccounts,
    summarizeTimelinePeriod, type ForecastPeriodAccountSummary,
} from "../domain/forecast-timeline";
import {
    ForecastChart, type ForecastChartView, type ForecastSavingsPoint
} from "./forecast-chart";
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
            : source === "budget"
                ? ReceiptText
                : source === "card_payment"
                    ? CreditCard
                    : source === "fixed_income"
                        ? Landmark
                        : source === "savings_simulation"
                            ? PiggyBank
                            : ReceiptText;
}

export function ForecastClient({
    accounts, cardPaymentSettings, events,
    dismissedCardPaymentKeys: savedDismissedCardPaymentKeys, dismissedCardPayments,
    linkedSavings, savingsSimulations, savedViews, now,
}: ForecastData) {
    const router = useRouter();
    const anchorNow = useMemo(() => new Date(now), [now]);
    const minimumDate = toAppDateInputValue(anchorNow);
    const maximumDate = toAppDateInputValue(addAppCalendarDays(anchorNow, 180));
    const currencies = [...new Set(accounts.map((account) => account.currency))];
    const [initialView] = useState(() => savedViews.find((view) => view.isDefault) ?? null);
    const [initialSettings] = useState(() => initialView ? resolveViewSettings(initialView) : null);
    const [viewSelection, setViewSelection] = useState<string | null>(initialView?.id ?? null);
    const [startsAtValue, setStartsAtValue] = useState(initialSettings?.startsOn ?? minimumDate);
    const [endsAtValue, setEndsAtValue] = useState(initialSettings?.endsOn ?? toAppDateInputValue(addAppCalendarDays(anchorNow, 30)));
    const [activePreset, setActivePreset] = useState<number | null>(initialSettings ? initialSettings.preset : 30);
    const [currency, setCurrency] = useState<string>(initialSettings?.currency ?? "all");
    const [accountKind, setAccountKind] = useState<ForecastAccountKind>(initialSettings?.accountKind ?? "all");
    const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(initialSettings?.accountIds ?? new Set());
    const [granularity, setGranularity] = useState<ForecastGranularity>(initialSettings?.granularity ?? "week");
    const [savingsMode, setSavingsMode] = useState<LinkedSavingsMode>(initialSettings?.savingsMode ?? "exclude");
    const [chartView, setChartView] = useState<ForecastChartView>(initialSettings?.chartView ?? "balance");
    const [expandedPeriods, setExpandedPeriods] = useState<Map<string, string | null>>(new Map());
    const [cardToConfigure, setCardToConfigure] = useState<ForecastData["accounts"][number] | null>(null);
    const [locallyDismissedPaymentKeys, setLocallyDismissedPaymentKeys] = useState<Set<string>>(new Set());
    const [locallyRestoredPaymentKeys, setLocallyRestoredPaymentKeys] = useState<Set<string>>(new Set());
    const [dismissingPaymentId, setDismissingPaymentId] = useState<string | null>(null);
    const [payingStatementId, setPayingStatementId] = useState<string | null>(null);

    const [statementAwaitingFunds, setStatementAwaitingFunds] = useState<{
        eventId: string;
        creditAccountId: string;
        sourceAccountId: string;
        kind: FundsImpact["kind"];
    } | null>(null);

    const [simulation, setSimulation] = useState<SavingsSimulationDraft | null>(() => {
        if (initialSettings) return initialSettings.simulation;
        const preferred = savingsSimulations.find((item) => item.isDefault);
        return preferred ? { ...preferred } : null;
    });

    function resolveViewSettings(view: SavedForecastView) {
        const range = resolveForecastViewRange(view, {
            minimumDate,
            maximumDate,
            addDays: (date, days) => toAppDateInputValue(addAppCalendarDays(fromForecastDateInput(date) ?? anchorNow, days)),
        });
        const viewCurrency = currencies.some((item) => item === view.currency) ? view.currency : "all";
        const savedSimulation = savingsSimulations.find((item) => item.id === view.savingsSimulationId);

        return {
            ...range,
            currency: viewCurrency,
            accountKind: view.accountKind,
            accountIds: new Set(accounts
                .filter((account) => (
                    view.accountIds.includes(account.id)
                    && (viewCurrency === "all" || account.currency === viewCurrency)
                    && matchesAccountKind(account.type, view.accountKind)
                ))
                .map((account) => account.id)),
            granularity: view.granularity,
            savingsMode: linkedSavings.length ? view.savingsMode : "exclude" as const,
            chartView: view.chartView,
            simulation: savedSimulation ? { ...savedSimulation } : null,
        };
    }

    function selectView(next: string | null) {
        setViewSelection(next);
        if (next === null) return resetToDefaults();
        const view = savedViews.find((item) => item.id === next);
        if (!view) return;

        const settings = resolveViewSettings(view);
        setStartsAtValue(settings.startsOn);
        setEndsAtValue(settings.endsOn);
        setActivePreset(settings.preset);
        setCurrency(settings.currency);
        setAccountKind(settings.accountKind);
        setSelectedAccountIds(settings.accountIds);
        setGranularity(settings.granularity);
        setSavingsMode(settings.savingsMode);
        setChartView(settings.chartView);
        setSimulation(settings.simulation);
        setExpandedPeriods(new Map());
    }

    function resetToDefaults() {
        const preferredSimulation = savingsSimulations.find((item) => item.isDefault);
        setStartsAtValue(minimumDate);
        setEndsAtValue(toAppDateInputValue(addAppCalendarDays(anchorNow, 30)));
        setActivePreset(30);
        setCurrency("all");
        setAccountKind("all");
        setSelectedAccountIds(new Set());
        setGranularity("week");
        setSavingsMode("exclude");
        setChartView("balance");
        setSimulation(preferredSimulation ? { ...preferredSimulation } : null);
        setExpandedPeriods(new Map());
    }

    const sweepAccountId = simulation?.accountId;
    const sweepPositionId = simulation?.positionId;
    const sweepMinimumBalance = simulation?.minimumBalance || 0;

    const sweepRule = useMemo(
        () => sweepAccountId && sweepPositionId
            ? { accountId: sweepAccountId, positionId: sweepPositionId, minimumBalance: sweepMinimumBalance }
            : null,
        [sweepAccountId, sweepPositionId, sweepMinimumBalance],
    );

    const startsAt = fromForecastDateInput(startsAtValue) ?? anchorNow;
    const endsAt = fromForecastDateInput(endsAtValue) ?? addAppCalendarDays(anchorNow, 30);
    const forecastDays = Math.min(180, Math.max(
        1,
        Math.ceil((endsAt.getTime() - anchorNow.getTime()) / (24 * 60 * 60 * 1000)),
    ));
    const dismissedCardPaymentKeys = useMemo(() => [
        ...new Set([...savedDismissedCardPaymentKeys, ...locallyDismissedPaymentKeys]),
    ].filter((key) => !locallyRestoredPaymentKeys.has(key)), [
        savedDismissedCardPaymentKeys, locallyDismissedPaymentKeys, locallyRestoredPaymentKeys,
    ]);
    const visibleDismissedCardPayments = dismissedCardPayments.filter((payment) => (
        !locallyRestoredPaymentKeys.has(`${payment.creditAccountId}:${payment.dueAt.toISOString()}`)
    ));

    const projection = useMemo(() => sweepRule
        ? applySavingsSweep({
            accounts,
            events,
            savings: linkedSavings,
            mode: savingsMode,
            rule: sweepRule,
            settings: cardPaymentSettings,
            dismissedCardPaymentKeys,
            now: anchorNow,
            days: forecastDays,
        })
        : applyLinkedSavings({ accounts, events, savings: linkedSavings, mode: savingsMode }),
        [
            accounts, events, linkedSavings,
            savingsMode, cardPaymentSettings, dismissedCardPaymentKeys,
            anchorNow, forecastDays, sweepRule,
        ],
    );

    const forecast = useMemo(() => buildForecast({
        accounts: projection.accounts,
        events: projection.events,
        settings: cardPaymentSettings,
        dismissedCardPaymentKeys,
        now: anchorNow,
        days: forecastDays,
    }), [projection, cardPaymentSettings, dismissedCardPaymentKeys, anchorNow, forecastDays]);

    const selectableAccounts = accounts.filter((account) => (
        (currency === "all" || account.currency === currency)
        && matchesAccountKind(account.type, accountKind)
    ));

    const scopedAccountIds = withSavingsAccounts(
        new Set(selectableAccounts
            .filter((account) => selectedAccountIds.size === 0 || selectedAccountIds.has(account.id))
            .map((account) => account.id)),
        linkedSavings.flatMap((saving) => [
            { id: linkedSavingsAccountId(saving.positionId), fundingAccountId: saving.accountId },
            { id: simulatedSavingsAccountId(saving.positionId), fundingAccountId: saving.accountId },
        ]),
    );

    const isScopedToAccounts = accountKind !== "all" || selectedAccountIds.size > 0;
    const visibleEvents = forecast.events.filter((event) => (
        isInsideForecastRange(event.scheduledAt, startsAt, endsAt)
        && (currency === "all" || event.currency === currency)
        && (!isScopedToAccounts
            || (event.accountId !== null && scopedAccountIds.has(event.accountId))
            || (event.settlesAccountId != null && scopedAccountIds.has(event.settlesAccountId)))
    ));
    const visibleAccounts = forecast.accounts.filter((account) => scopedAccountIds.has(account.id));
    const visibleAlerts = forecast.alerts.filter((alert) => (
        isInsideForecastRange(alert.scheduledAt, startsAt, endsAt)
        && scopedAccountIds.has(alert.accountId)
    ));

    const selectedAccount = selectedAccountIds.size === 1
        ? selectableAccounts.find((account) => selectedAccountIds.has(account.id))
        : undefined;
    const isSelectedCredit = selectedAccount?.type === "credit";

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        const refreshAtNextDay = () => {
            timeoutId = setTimeout(() => {
                router.refresh();
                refreshAtNextDay();
            }, millisecondsUntilNextAppDay());
        };

        refreshAtNextDay();
        return () => clearTimeout(timeoutId);
    }, [router]);

    const cashFlow = selectedAccount
        ? buildCashFlow(
            visibleEvents.filter((event) => (
                event.currency === selectedAccount.currency
                && (event.accountId === selectedAccount.id || event.settlesAccountId === selectedAccount.id)
            )),
            granularity,
            selectedAccount.id,
        )
        : [];

    const debtActivity = isSelectedCredit ? buildCreditDebtActivity(visibleEvents, selectedAccount.id, granularity) : [];
    const chartCurrencies = new Set(selectTimelineAccounts(visibleAccounts).accounts.map((account) => account.currency));
    const chartCurrency = chartCurrencies.size === 1 ? [...chartCurrencies][0] : null;
    const hasScopedSavings = linkedSavings.some((saving) => scopedAccountIds.has(saving.accountId));
    const timeline = buildForecastTimeline({
        accounts: projection.accounts,
        events: forecast.events,
        accountIds: scopedAccountIds,
        startsAt,
        endsAt,
        granularity,
    });

    function buildSavingsPoints(): ForecastSavingsPoint[] {
        const modes: LinkedSavingsMode[] = ["exclude", "principal", "with_yield"];
        const projections = modes.map((mode) => applyLinkedSavings({ accounts, events, savings: linkedSavings, mode }));

        if (sweepRule) {
            projections.push(applySavingsSweep({
                accounts,
                events,
                savings: linkedSavings,
                mode: "with_yield",
                rule: sweepRule,
                settings: cardPaymentSettings,
                dismissedCardPaymentKeys,
                now: anchorNow,
                days: forecastDays,
            }));
        }

        const timelines = projections.map((modeProjection) => {
            const modeForecast = buildForecast({
                accounts: modeProjection.accounts,
                events: modeProjection.events,
                settings: cardPaymentSettings,
                dismissedCardPaymentKeys,
                now: anchorNow,
                days: forecastDays,
            });
            return buildForecastTimeline({
                accounts: modeProjection.accounts,
                events: modeForecast.events,
                accountIds: scopedAccountIds,
                startsAt,
                endsAt,
                granularity,
            }).points;
        });

        return timelines[0].map((point, index) => ({
            key: point.key,
            label: point.label,
            tooltipLabel: point.tooltipLabel,
            exclude: point.balance,
            principal: timelines[1][index]?.balance ?? point.balance,
            with_yield: timelines[2][index]?.balance ?? point.balance,
            ...(timelines[3] ? { sweep: timelines[3][index]?.balance ?? point.balance } : {}),
            changes: {
                exclude: point.balanceChange,
                principal: timelines[1][index]?.balanceChange ?? null,
                with_yield: timelines[2][index]?.balanceChange ?? null,
                ...(timelines[3] ? { sweep: timelines[3][index]?.balanceChange ?? null } : {}),
            },
        }));
    }
    const savingsPoints = chartView === "savings" && hasScopedSavings ? buildSavingsPoints() : null;
    const timelineGroups = groupTimelineEvents(visibleEvents, granularity);
    const accountTypes = new Map(forecast.accounts.map((account) => [account.id, account.type]));
    const sweepSavingsAccountId = sweepRule ? simulatedSavingsAccountId(sweepRule.positionId) : null;
    const summaryMerges = new Map(sweepRule && sweepSavingsAccountId ? [[sweepRule.accountId, sweepSavingsAccountId]] : []);
    const summaryNames = new Map(sweepRule && sweepSavingsAccountId
        ? [[sweepSavingsAccountId, linkedSavings.find((saving) => saving.positionId === sweepRule.positionId)?.name ?? ""]]
        : []);

    function togglePeriod(periodKey: string, accountId: string | null = null) {
        setExpandedPeriods((current) => {
            const next = new Map(current);
            if (next.has(periodKey) && next.get(periodKey) === accountId) next.delete(periodKey);
            else next.set(periodKey, accountId);
            return next;
        });
    }

    const resolveSummaryAccount = (accountId: string) => summaryMerges.get(accountId) ?? accountId;

    function itemTouchesAccount(item: (typeof timelineGroups)[number]["items"][number], accountId: string) {
        const event = item.kind === "event" ? item.event : item.last;
        return [event.accountId, event.settlesAccountId].some((id) => id && resolveSummaryAccount(id) === accountId);
    }
    const liquiditySummaries = buildLiquidityRangeSummaries({
        accounts: projection.accounts,
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

    function keepSelectableAccounts(nextCurrency: string, nextKind: ForecastAccountKind) {
        setSelectedAccountIds((current) => new Set(accounts
            .filter((account) => (
                current.has(account.id)
                && (nextCurrency === "all" || account.currency === nextCurrency)
                && matchesAccountKind(account.type, nextKind)
            ))
            .map((account) => account.id)));
    }

    function selectCurrency(value: string) {
        setCurrency(value);
        keepSelectableAccounts(value, accountKind);
    }

    function selectAccountKind(value: ForecastAccountKind) {
        setAccountKind(value);
        keepSelectableAccounts(currency, value);
    }

    function selectStartsAt(value: string) {
        setStartsAtValue(value);
        setActivePreset(null);

        const nextStart = fromForecastDateInput(value);
        if (nextStart && nextStart >= endsAt) {
            setEndsAtValue(toAppDateInputValue(addAppCalendarDays(nextStart, 1)));
        }
    }

    async function dismissPayment(eventId: string, creditAccountId: string, dueAt: Date) {
        setDismissingPaymentId(eventId);
        try {
            const result = await dismissCardPayment({ creditAccountId, dueAt });
            if (!result.success) {
                toast.error(result.message);
                return;
            }

            setLocallyDismissedPaymentKeys((current) => new Set([
                ...current,
                `${creditAccountId}:${dueAt.toISOString()}`,
            ]));
            setLocallyRestoredPaymentKeys((current) => {
                const next = new Set(current);
                next.delete(`${creditAccountId}:${dueAt.toISOString()}`);
                return next;
            });
            toast.success(result.message);
            router.refresh();
        } catch {
            toast.error("No fue posible omitir el pago. Inténtalo de nuevo.");
        } finally {
            setDismissingPaymentId(null);
        }
    }

    async function payStatement(eventId: string, creditAccountId: string, sourceAccountId: string, allowInsufficientFunds = false) {
        setStatementAwaitingFunds(null);
        setPayingStatementId(eventId);

        try {
            const result = await payCardStatement({ creditAccountId, sourceAccountId, allowInsufficientFunds });
            if (result.insufficientFunds) {
                setStatementAwaitingFunds({
                    eventId, creditAccountId, sourceAccountId, kind: result.insufficientFunds,
                });
                return;
            }

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            router.refresh();
        } catch {
            toast.error("No fue posible registrar el pago. Inténtalo de nuevo.");
        } finally {
            setPayingStatementId(null);
        }
    }

    async function restorePayment(creditAccountId: string, dueAt: Date) {
        const key = `${creditAccountId}:${dueAt.toISOString()}`;
        setDismissingPaymentId(`restore:${key}`);

        try {
            const result = await restoreCardPayment({ creditAccountId, dueAt });
            if (!result.success) {
                toast.error(result.message);
                return;
            }

            setLocallyRestoredPaymentKeys((current) => new Set([...current, key]));
            setLocallyDismissedPaymentKeys((current) => {
                const next = new Set(current);
                next.delete(key);
                return next;
            });
            toast.success(result.message);
            router.refresh();
        } catch {
            toast.error("No fue posible volver a incluir el pago. Inténtalo de nuevo.");
        } finally {
            setDismissingPaymentId(null);
        }
    }

    function renderTimelineEvent(event: (typeof forecast.events)[number], dateText?: string) {
        const Icon = eventIcon(event.source);
        const isIncome = event.transactionType === "income";
        const account = event.accountId ? forecast.accounts.find((item) => item.id === event.accountId) : null;
        const settledAccount = event.settlesAccountId ? forecast.accounts.find((item) => item.id === event.settlesAccountId) : null;
        const balanceDescription = event.balanceAfter === null
            ? event.source === "card_payment"
                ? "Pago manual por confirmar"
                : "Cuenta de pago por definir"
            : [
                `${account?.type === "credit" ? "Deuda" : "Saldo"} ${account?.name ?? ""}: ${money(event.balanceAfter, event.currency)}`,
                settledAccount && event.settledBalanceAfter !== null
                    ? `${settledAccount.type === "credit" ? "Deuda" : "Saldo"} ${settledAccount.name}: ${money(event.settledBalanceAfter, event.currency)}`
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
                            {dateText ?? formatAppDate(event.scheduledAt, {
                                weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                            })}
                            {event.source === "recurring"
                                ? " · Recurrencia"
                                : event.source === "financing"
                                    ? " · Cuota por cubrir"
                                    : event.source === "budget"
                                        ? " · Presupuesto estimado"
                                        : event.source === "card_payment"
                                            ? event.affectsBalance
                                                ? " · Pago proyectado de tarjeta"
                                                : " · Compromiso manual"
                                            : event.source === "fixed_income"
                                                ? " · Renta fija"
                                                : event.source === "savings_simulation"
                                                    ? " · Ahorro automático (simulado)"
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
                {event.source === "card_payment" && event.settlesAccountId && event.cardPaymentDueAt && (
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                        {event.id.startsWith("card-statement:") && event.affectsBalance && event.accountId && (
                            <Button
                                type="button"
                                size="sm"
                                disabled={payingStatementId === event.id}
                                onClick={() => void payStatement(event.id, event.settlesAccountId!, event.accountId!)}
                                className="cursor-pointer"
                            >
                                {payingStatementId === event.id ? "Registrando..." : "Pagar estado de cuenta"}
                            </Button>
                        )}
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={dismissingPaymentId === event.id}
                            onClick={() => void dismissPayment(event.id, event.settlesAccountId!, event.cardPaymentDueAt!)}
                            className="cursor-pointer"
                        >
                            Omitir este pago
                        </Button>
                    </div>
                )}
            </article>
        );
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

            <ForecastSavedViews
                views={savedViews}
                selection={viewSelection}
                onSelectionChange={selectView}
                hasUnsavedSimulation={simulation !== null && !simulation.id}
                settings={{
                    rangePresetDays: activePreset,
                    startsOn: startsAtValue,
                    endsOn: endsAtValue,
                    currency,
                    accountKind,
                    accountIds: [...selectedAccountIds],
                    granularity,
                    savingsMode,
                    chartView,
                    savingsSimulationId: simulation?.id ?? null,
                }}
            />

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
                hasLinkedSavings={linkedSavings.length > 0}
                savingsMode={savingsMode}
                onSavingsModeChange={setSavingsMode}
            />

            <ForecastSavingsSimulation
                accounts={accounts}
                linkedSavings={linkedSavings}
                simulations={savingsSimulations}
                value={simulation}
                onChange={setSimulation}
            />

            {!accounts.length ? (
                <EmptyState />
            ) : (
                <>
                    <ForecastAccountFilters
                        kind={accountKind}
                        onKindChange={selectAccountKind}
                        accounts={selectableAccounts}
                        selectedAccountIds={selectedAccountIds}
                        onSelectedAccountIdsChange={setSelectedAccountIds}
                    />

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
                                                : `la deuda proyectada excedería el límite por ${money(alert.amount, account?.currency ?? "MXN")} el ${formatAppDate(alert.scheduledAt, { day: "numeric", month: "long" })}.`
                                            }
                                        </p>
                                    </motion.article>
                                );
                            })}
                        </section>
                    )}

                    {selectedAccountIds.size === 0 && accountKind !== "credit" && <LiquiditySummary summaries={liquiditySummaries} />}

                    <ForecastChart
                        view={chartView}
                        onViewChange={setChartView}
                        hasSavings={hasScopedSavings}
                        measure={timeline.measure}
                        points={timeline.points}
                        savingsPoints={savingsPoints}
                        currency={chartCurrency}
                        emptyMessage={visibleAccounts.length ? null : "No hay cuentas con estos filtros."}
                    />

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
                                    {account.fundingAccountId && (
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            Cajita de {accounts.find((item) => item.id === account.fundingAccountId)?.name ?? "otra cuenta"}
                                        </p>
                                    )}
                                    {isCredit && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCardToConfigure({
                                                ...account,
                                                calculatedStatementBalance: account.calculatedStatementBalance ?? null,
                                            })}
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
                                        : "Selecciona una sola cuenta para no mezclar monedas ni saldos."
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
                                        ? `${visibleEvents.length} compromiso${visibleEvents.length === 1 ? "" : "s"} entre ${formatAppDate(startsAt, { day: "numeric", month: "short" })} y ${formatAppDate(endsAt, { day: "numeric", month: "short", year: "numeric" })}.`
                                        : "No hay movimientos previstos en el rango seleccionado."
                                    }
                                </p>
                            </div>
                            <CalendarClock className="size-5 text-muted-foreground" />
                        </div>
                        {visibleEvents.length > 0 && timelineGroups.map((group) => {
                            const periodKey = `${granularity}:${group.key}`;
                            const isExpanded = !group.label || expandedPeriods.has(periodKey);
                            const focusedAccountId = group.label ? expandedPeriods.get(periodKey) ?? null : null;
                            const shownItems = focusedAccountId
                                ? group.items.filter((item) => itemTouchesAccount(item, focusedAccountId))
                                : group.items;
                            const movementCount = group.items.reduce((total, item) => total + (item.kind === "event" ? 1 : item.days), 0);

                            return (
                                <div key={group.key}>
                                    {group.label && (
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            aria-expanded={isExpanded}
                                            onClick={() => togglePeriod(periodKey)}
                                            onKeyDown={(keyEvent) => {
                                                if (keyEvent.target !== keyEvent.currentTarget) return;
                                                if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
                                                keyEvent.preventDefault();
                                                togglePeriod(periodKey);
                                            }}
                                            className="w-full cursor-pointer border-b bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted/70 sm:px-5"
                                        >
                                            <span className="flex items-center gap-2 text-sm font-semibold">
                                                <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                                <span className="inline-block flex-1 first-letter:uppercase">{group.label}</span>
                                                <span className="text-xs font-normal text-muted-foreground">
                                                    {movementCount} movimiento{movementCount === 1 ? "" : "s"}
                                                </span>
                                            </span>
                                            <PeriodAccountSummaries
                                                summaries={summarizeTimelinePeriod(group.items, accountTypes, summaryMerges)}
                                                accounts={forecast.accounts}
                                                names={summaryNames}
                                                focusedAccountId={isExpanded ? focusedAccountId : null}
                                                onSelect={(accountId) => togglePeriod(periodKey, accountId)}
                                            />
                                        </div>
                                    )}
                                    <AnimatedCollapse open={isExpanded}>
                                        <motion.div
                                            key={focusedAccountId ?? "all"}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.2 }}
                                            className="divide-y"
                                        >
                                            {focusedAccountId && !shownItems.length && (
                                                <p className="p-5 text-sm text-muted-foreground">
                                                    No hay movimientos de esta cuenta en el periodo.
                                                </p>
                                            )}
                                            {shownItems.map((item) => item.kind === "event"
                                                ? renderTimelineEvent(item.event)
                                                : renderTimelineEvent(
                                                    {
                                                        ...item.last,
                                                        id: item.id,
                                                        amount: item.amount,
                                                        name: item.days > 1 ? `${item.last.name} · ${item.days} días` : item.last.name,
                                                    },
                                                    item.days > 1
                                                        ? `${formatAppDate(item.firstAt, { day: "numeric", month: "short" })} – ${formatAppDate(item.last.scheduledAt, { day: "numeric", month: "short" })}`
                                                        : undefined,
                                                ))}
                                        </motion.div>
                                    </AnimatedCollapse>
                                </div>
                            );
                        })}
                    </section>

                    {visibleDismissedCardPayments.length > 0 && (
                        <section className="rounded-2xl border border-dashed bg-muted/30 p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="font-semibold">Pagos omitidos</h2>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        Puedes volver a incluirlos cuando quieras.
                                    </p>
                                </div>
                            </div>
                            <div className="mt-3 divide-y rounded-xl border bg-background">
                                {visibleDismissedCardPayments.map((payment) => {
                                    const card = accounts.find((account) => account.id === payment.creditAccountId);
                                    const key = `${payment.creditAccountId}:${payment.dueAt.toISOString()}`;
                                    return (
                                        <div key={key} className="flex flex-wrap items-center justify-between gap-3 p-3">
                                            <p className="text-sm">
                                                <span className="font-medium">{card?.name ?? "Tarjeta archivada"}</span>
                                                <span className="text-muted-foreground"> · vencía el {formatAppDate(payment.dueAt, { day: "numeric", month: "long" })}</span>
                                            </p>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={dismissingPaymentId === `restore:${key}`}
                                                onClick={() => void restorePayment(payment.creditAccountId, payment.dueAt)}
                                                className="cursor-pointer"
                                            >
                                                Volver a incluir
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

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

            <InsufficientFundsDialog
                kind={statementAwaitingFunds?.kind ?? null}
                isPending={payingStatementId !== null}
                onCancel={() => setStatementAwaitingFunds(null)}
                onConfirm={() => {
                    if (!statementAwaitingFunds) return;
                    const { eventId, creditAccountId, sourceAccountId } = statementAwaitingFunds;
                    void payStatement(eventId, creditAccountId, sourceAccountId, true);
                }}
            />
        </div>
    );
}

function AnimatedCollapse({ open, children }: { open: boolean; children: ReactNode }) {
    const contentRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | "auto">("auto");

    useEffect(() => {
        const content = contentRef.current;
        if (!open || !content) return;
        const observer = new ResizeObserver(([entry]) => setHeight(entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height));
        observer.observe(content);
        return () => observer.disconnect();
    }, [open]);

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height, opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                >
                    <div ref={contentRef}>{children}</div>
                </motion.div>
            )}
        </AnimatePresence>
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

function PeriodAccountSummaries({ summaries, accounts, names, focusedAccountId, onSelect }: {
    summaries: ForecastPeriodAccountSummary[];
    accounts: Array<{ id: string; name: string; type: string; currency: string }>;
    names: Map<string, string>;
    focusedAccountId: string | null;
    onSelect: (accountId: string) => void;
}) {
    const nameOf = (accountId: string) => names.get(accountId) || accounts.find((account) => account.id === accountId)?.name || "";
    const rows = accounts.flatMap((account) => {
        const summary = summaries.find((item) => item.accountId === account.id);
        return summary ? [{ account, summary }] : [];
    });
    
    if (!rows.length) return null;

    return (
        <span className="mt-2 grid gap-1.5 pl-6 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ account, summary }) => {
                const isCredit = account.type === "credit";
                const figures = [
                    { label: isCredit ? "Pagos" : "Ingresos", value: summary.incomes, sign: isCredit ? "-" : "+" },
                    { label: "Rendimiento", value: summary.yields, sign: "+" },
                    { label: isCredit ? "Cargos" : "Gastos", value: summary.expenses, sign: isCredit ? "+" : "-" },
                    { label: "Traspasos recibidos", value: summary.transfersIn, sign: "+" },
                    { label: "Traspasos enviados", value: summary.transfersOut, sign: "-" },
                ].filter((figure) => figure.value > 0);

                return (
                    <button
                        key={account.id}
                        type="button"
                        aria-pressed={focusedAccountId === account.id}
                        onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            onSelect(account.id);
                        }}
                        className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs ring-1 transition-colors ${focusedAccountId === account.id
                            ? "bg-background ring-foreground/30"
                            : "bg-background/60 ring-transparent hover:bg-background"
                            }`}
                    >
                        <span className="block font-medium">{nameOf(account.id)}</span>
                        <span className="mt-0.5 block text-muted-foreground">
                            {figures.map((figure) => `${figure.label} ${figure.sign}${money(figure.value, account.currency)}`).join(" · ")}
                            {summary.closingBalance !== null && (
                                <>
                                    {figures.length ? " · " : ""}
                                    <span className="text-foreground">
                                        {isCredit ? "Deuda al cierre" : "Cierre"} {money(summary.closingBalance, account.currency)}
                                    </span>
                                </>
                            )}
                            {summary.mergedBalances.map((merged) => (
                                ` · En ${nameOf(merged.accountId)} ${money(merged.balance, account.currency)}`
                            ))}
                        </span>
                    </button>
                );
            })}
        </span>
    );
}
