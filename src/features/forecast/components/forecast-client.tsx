"use client";

import {
    useEffect, useMemo, useState
} from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
    AlertTriangle, CalendarClock, ChevronRight,
    Info, CreditCard, Landmark,
    PiggyBank, ReceiptText, Repeat2,
    Settings2,
} from "lucide-react";
import { motion } from "framer-motion";
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
import { ForecastToolbar } from "./forecast-toolbar";
import {
    FORECAST_END_DATE, RELIABLE_RANGE_DAYS, getForecastHorizonDays,
    enforceGranularity, forecastRangeDays, suggestGranularity,
} from "../domain/forecast-horizon";
import { AnimatedCollapse } from "./animated-collapse";
import {
    Amount, ForecastPanel, ForecastPanelHeader,
    IconBadge, TONE_SURFACE, TONE_TEXT,
    formatMoney, formatSignedMoney, toneOf,
} from "./forecast-ui";
import { ForecastKeyFigures, type CardDebtSummary } from "./forecast-key-figures";
import { ForecastAlerts, type ForecastAlertItem } from "./forecast-alerts";
import {
    buildCashFlow, buildCreditDebtActivity, buildForecast,
    getPeriod, type ForecastEventSource, type ForecastGranularity,
} from "../domain/forecast-calculator";
import { buildLiquidityRangeSummaries } from "../domain/liquidity-calculator";
import {
    applyLinkedSavings, linkedSavingsAccountId, withSavingsAccounts,
    type LinkedSavingsMode,
} from "../domain/linked-savings";
import {
    applySavingsSweep, getValidSweepRules, simulatedSavingsAccountId,
    type SavingsSweepRule,
} from "../domain/savings-sweep";
import type { SavingsSimulationDraft } from "./forecast-savings-simulation";
import {
    matchesAccountKind, resolveForecastViewRange, type ForecastViewAccountKind as ForecastAccountKind,
    type SavedForecastView,
} from "../domain/forecast-view";
import {
    buildForecastTimeline, groupTimelineEvents, selectTimelineAccounts,
    summarizeTimelinePeriod, type ForecastPeriodAccountSummary,
} from "../domain/forecast-timeline";
import {
    ForecastChart, type ForecastChartView, type ForecastSavingsPoint
} from "./forecast-chart";
import type { ForecastData } from "../queries/get-forecast-data";
import { fromForecastDateInput, isInsideForecastRange } from "../utils/forecast-filters";


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
    const maximumDate = FORECAST_END_DATE;
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
    const [focusedAccountId, setFocusedAccountId] = useState<string | null>(null);
    const [highlightedAnchor, setHighlightedAnchor] = useState<string | null>(null);
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
            granularity: enforceGranularity(view.granularity, forecastRangeDays(range.startsOn, range.endsOn)),
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
        setFocusedAccountId(null);
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
        setFocusedAccountId(null);
    }

    const sweepRulesKey = JSON.stringify(getValidSweepRules(
        (simulation?.rules ?? []).map((rule) => ({ ...rule, minimumBalance: rule.minimumBalance || 0 })),
        linkedSavings,
    ));
    const sweepRules = useMemo((): SavingsSweepRule[] => JSON.parse(sweepRulesKey), [sweepRulesKey]);

    const startsAt = fromForecastDateInput(startsAtValue) ?? anchorNow;
    const endsAt = fromForecastDateInput(endsAtValue) ?? addAppCalendarDays(anchorNow, 30);
    const forecastDays = Math.min(getForecastHorizonDays(anchorNow), Math.max(
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

    const projection = useMemo(() => sweepRules.length
        ? applySavingsSweep({
            accounts,
            events,
            savings: linkedSavings,
            mode: savingsMode,
            rules: sweepRules,
            settings: cardPaymentSettings,
            dismissedCardPaymentKeys,
            now: anchorNow,
            days: forecastDays,
        })
        : applyLinkedSavings({ accounts, events, savings: linkedSavings, mode: savingsMode }),
        [
            accounts, events, linkedSavings,
            savingsMode, cardPaymentSettings, dismissedCardPaymentKeys,
            anchorNow, forecastDays, sweepRules,
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

    const savingsLinks = linkedSavings.flatMap((saving) => [
        { id: linkedSavingsAccountId(saving.positionId), fundingAccountId: saving.accountId },
        { id: simulatedSavingsAccountId(saving.positionId), fundingAccountId: saving.accountId },
    ]);
    const filteredAccountIds = withSavingsAccounts(
        new Set(selectableAccounts
            .filter((account) => selectedAccountIds.size === 0 || selectedAccountIds.has(account.id))
            .map((account) => account.id)),
        savingsLinks,
    );
    const accountCards = forecast.accounts.filter((account) => filteredAccountIds.has(account.id));
    const focusedAccount = accountCards.find((account) => account.id === focusedAccountId) ?? null;
    const scopedAccountIds = focusedAccount
        ? withSavingsAccounts(new Set([focusedAccount.id]), savingsLinks)
        : filteredAccountIds;
    const hasExplicitAccounts = focusedAccount !== null || selectedAccountIds.size > 0;
    const isScopedToAccounts = hasExplicitAccounts || accountKind !== "all";
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

    const selectedAccount = focusedAccount ?? (selectedAccountIds.size === 1
        ? forecast.accounts.find((account) => selectedAccountIds.has(account.id))
        : undefined);
    const alertedAccountIds = new Set(forecast.alerts
        .filter((alert) => isInsideForecastRange(alert.scheduledAt, startsAt, endsAt))
        .map((alert) => alert.accountId));
    const isSelectedCredit = selectedAccount?.type === "credit";

    useEffect(() => {
        if (!highlightedAnchor) return;
        const timeoutId = setTimeout(() => setHighlightedAnchor(null), 1800);
        return () => clearTimeout(timeoutId);
    }, [highlightedAnchor]);

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

        if (sweepRules.length) {
            projections.push(applySavingsSweep({
                accounts,
                events,
                savings: linkedSavings,
                mode: "with_yield",
                rules: sweepRules,
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
    const showsSavingsComparison = hasScopedSavings && savingsMode !== "exclude";
    const showsYields = hasScopedSavings && (savingsMode === "with_yield" || sweepRules.length > 0);
    const savingsPoints = chartView === "savings" && showsSavingsComparison ? buildSavingsPoints() : null;
    const timelineGroups = groupTimelineEvents(visibleEvents, granularity);
    const accountTypes = new Map(forecast.accounts.map((account) => [account.id, account.type]));
    const summaryMerges = new Map(sweepRules.map((rule) => [rule.accountId, simulatedSavingsAccountId(rule.positionId)]));
    const summaryNames = new Map(sweepRules.map((rule) => [
        simulatedSavingsAccountId(rule.positionId),
        linkedSavings.find((saving) => saving.positionId === rule.positionId)?.name ?? "",
    ]));

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
        accounts: projection.accounts
            .filter((account) => !isScopedToAccounts || scopedAccountIds.has(account.id))
            .map((account) => hasExplicitAccounts ? { ...account, includeInLiquidity: account.type !== "credit" } : account),
        events: forecast.events,
        startsAt,
        endsAt,
        currency: currency === "all" ? undefined : currency as ForecastData["accounts"][number]["currency"],
    });

    const cardDebts = [...visibleAccounts
        .filter((account) => account.type === "credit")
        .reduce((totals, account) => {
            const current = totals.get(account.currency) ?? { currency: account.currency, today: 0, projected: 0, cards: 0 };
            current.today += account.currentBalance;
            current.projected += account.projectedBalance;
            current.cards += 1;
            return totals.set(account.currency, current);
        }, new Map<string, CardDebtSummary>())
        .values()];
    const alertItems: ForecastAlertItem[] = [
        ...visibleAlerts.map((alert, index): ForecastAlertItem => {
            const account = accounts.find((item) => item.id === alert.accountId);
            const amount = formatMoney(alert.amount, account?.currency ?? "MXN");
            return alert.kind === "overdue_payment"
                ? {
                    key: `${alert.accountId}:${alert.kind}:${index}`,
                    title: `Pago vencido de ${account?.name ?? "una tarjeta"}`,
                    detail: `${amount} exigible desde hoy`,
                    scheduledAt: alert.scheduledAt,
                    severity: "critical",
                }
                : {
                    key: `${alert.accountId}:${alert.kind}:${index}`,
                    title: `${account?.name ?? "Una tarjeta"} excede su límite`,
                    detail: `por ${amount} el ${formatAppDate(alert.scheduledAt, { day: "numeric", month: "long" })}`,
                    scheduledAt: alert.scheduledAt,
                    severity: "warning",
                };
        }),
        ...liquiditySummaries
            .filter((summary) => summary.firstNegativeAt)
            .map((summary): ForecastAlertItem => ({
                key: `liquidity:${summary.currency}`,
                title: `Liquidez negativa en ${summary.currency}`,
                detail: `desde el ${formatAppDate(summary.firstNegativeAt!, { day: "numeric", month: "long" })}`,
                scheduledAt: summary.firstNegativeAt!,
                severity: "critical",
            })),
    ];

    function selectPreset(days: number) {
        const nextEndsOn = toAppDateInputValue(addAppCalendarDays(anchorNow, days));
        setStartsAtValue(minimumDate);
        setEndsAtValue(nextEndsOn);
        setActivePreset(days);
        setGranularity((current) => suggestGranularity(current, forecastRangeDays(minimumDate, nextEndsOn)));
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

    function selectRange(nextStartsOn: string, nextEndsOn: string) {
        setStartsAtValue(nextStartsOn);
        setEndsAtValue(nextEndsOn);
        setActivePreset(null);
        setGranularity((current) => suggestGranularity(current, forecastRangeDays(nextStartsOn, nextEndsOn)));
    }

    function keepAvailableChartView(nextMode: LinkedSavingsMode, hasSimulation: boolean) {
        if (chartView === "savings" && nextMode === "exclude") setChartView("balance");
        if (chartView === "yields" && nextMode !== "with_yield" && !hasSimulation) setChartView("balance");
    }

    function selectSavingsMode(nextMode: LinkedSavingsMode) {
        setSavingsMode(nextMode);
        keepAvailableChartView(nextMode, simulation !== null);
    }

    function selectSimulation(next: SavingsSimulationDraft | null) {
        setSimulation(next);
        keepAvailableChartView(savingsMode, next !== null);
    }

    function revealPeriod(pointKey: string) {
        const anchor = granularity === "day" ? `timeline-day-${pointKey}` : `timeline-period-${granularity}:${pointKey}`;
        const hasMovements = granularity === "day"
            ? visibleEvents.some((event) => getPeriod(event.scheduledAt, "day").key === pointKey)
            : timelineGroups.some((group) => group.key === pointKey);
        if (!hasMovements) {
            toast("No hay movimientos en ese periodo.");
            return;
        }

        if (granularity !== "day") {
            const periodKey = `${granularity}:${pointKey}`;
            setExpandedPeriods((current) => current.has(periodKey) ? current : new Map(current).set(periodKey, null));
        }
        setHighlightedAnchor(anchor);
        requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }

    function toggleFocus(accountId: string) {
        setFocusedAccountId((current) => current === accountId ? null : accountId);
    }

    function clearFilters() {
        setCurrency("all");
        setAccountKind("all");
        setSelectedAccountIds(new Set());
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

    function renderTimelineEvent(event: (typeof forecast.events)[number], dateText?: string, anchorId?: string) {
        const Icon = eventIcon(event.source);
        const isIncome = event.transactionType === "income";
        const account = event.accountId ? forecast.accounts.find((item) => item.id === event.accountId) : null;
        const settledAccount = event.settlesAccountId ? forecast.accounts.find((item) => item.id === event.settlesAccountId) : null;
        const balanceDescription = event.balanceAfter === null
            ? event.source === "card_payment"
                ? "Pago manual por confirmar"
                : "Cuenta de pago por definir"
            : [
                `${account?.type === "credit" ? "Deuda" : "Saldo"} ${account?.name ?? ""}: ${formatMoney(event.balanceAfter, event.currency)}`,
                settledAccount && event.settledBalanceAfter !== null
                    ? `${settledAccount.type === "credit" ? "Deuda" : "Saldo"} ${settledAccount.name}: ${formatMoney(event.settledBalanceAfter, event.currency)}`
                    : null,
            ].filter(Boolean).join(" · ");

        return (
            <article
                key={event.id}
                id={anchorId}
                className={`scroll-mt-36 px-4 py-3.5 transition-colors duration-700 sm:px-5 ${anchorId && highlightedAnchor === anchorId ? "bg-primary/10" : ""}`}
            >
                <div className="flex items-center gap-3">
                    <IconBadge tone={isIncome ? "positive" : "negative"}>
                        <Icon />
                    </IconBadge>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{event.name}</p>
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
                        <Amount
                            value={isIncome ? event.amount : -event.amount}
                            currency={event.currency}
                            signed
                            tone={isIncome ? "positive" : "negative"}
                            className="block text-sm font-semibold"
                        />
                        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
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

            <ForecastToolbar
                views={savedViews}
                viewSelection={viewSelection}
                onViewSelect={selectView}
                draft={{
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
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onPresetChange={selectPreset}
                onRangeChange={selectRange}
                onGranularityChange={setGranularity}
                currencies={currencies}
                onCurrencyChange={selectCurrency}
                onAccountKindChange={selectAccountKind}
                accounts={accounts}
                selectableAccounts={selectableAccounts}
                selectedAccountIds={selectedAccountIds}
                onSelectedAccountIdsChange={setSelectedAccountIds}
                onClearFilters={clearFilters}
                onSavingsModeChange={selectSavingsMode}
                linkedSavings={linkedSavings}
                simulations={savingsSimulations}
                simulation={simulation}
                onSimulationChange={selectSimulation}
                focusedAccountName={focusedAccount?.name ?? null}
                onClearFocus={() => setFocusedAccountId(null)}
            />

            {!accounts.length ? (
                <EmptyState />
            ) : (
                <>
                    <ForecastAlerts alerts={alertItems} />

                    {forecastRangeDays(startsAtValue, endsAtValue) > RELIABLE_RANGE_DAYS && (
                        <p className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
                            <Info className="mt-px size-3.5 shrink-0" />
                            Más allá de 6 meses la previsión se apoya en supuestos: tasas de cajitas constantes,
                            presupuestos que se repiten y tus planes de pago actuales. Úsala para ver la tendencia.
                        </p>
                    )}

                    <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
                        <div className="contents xl:block xl:min-w-0 xl:space-y-6">
                            <div className="order-2 min-w-0">
                                <ForecastChart
                                    view={chartView}
                                    onViewChange={setChartView}
                                    onPeriodSelect={revealPeriod}
                                    hasSavings={showsSavingsComparison}
                                    showsYields={showsYields}
                                    yieldsEmptyMessage="No hay rendimientos previstos en este rango."
                                    measure={timeline.measure}
                                    points={timeline.points}
                                    savingsPoints={savingsPoints}
                                    currency={chartCurrency}
                                    emptyMessage={visibleAccounts.length ? null : "No hay cuentas con estos filtros."}
                                />
                            </div>
                            <div className="order-4 min-w-0 space-y-6">
                                <ForecastPanel>
                                    <ForecastPanelHeader
                                        className={selectedAccount ? undefined : "border-b-0"}
                                        title={isSelectedCredit ? "Actividad de deuda" : "Flujo de efectivo"}
                                        description={selectedAccount
                                            ? isSelectedCredit
                                                ? `Cargos y pagos que modifican la deuda de ${selectedAccount.name}.`
                                                : `Ingresos y gastos previstos en ${selectedAccount.name}.`
                                            : "Enfoca o filtra una sola cuenta para ver su flujo sin mezclar monedas ni saldos."}
                                        action={selectedAccount && (
                                            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                                                {granularity === "day" ? "Por día" : granularity === "week" ? "Por semana" : "Por mes"}
                                            </span>
                                        )}
                                    />
                                    {selectedAccount && (
                                        <div className="hidden grid-cols-[minmax(0,1fr)_repeat(3,8rem)] gap-6 border-b bg-muted/40 px-5 py-2 text-xs font-medium text-muted-foreground sm:grid">
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
                                                    className="grid gap-3 px-4 py-3.5 text-sm tabular-nums sm:grid-cols-[minmax(0,1fr)_repeat(3,8rem)] sm:items-center sm:gap-6 sm:px-5"
                                                >
                                                    <p className="font-medium first-letter:uppercase">{period.label}</p>
                                                    <p className={`${TONE_TEXT.negative} sm:text-right`}>
                                                        <span className="mr-1 text-xs text-muted-foreground sm:hidden">Cargos:</span>
                                                        +{formatMoney(period.charges, selectedAccount.currency)}
                                                    </p>
                                                    <p className={`${TONE_TEXT.positive} sm:text-right`}>
                                                        <span className="mr-1 text-xs text-muted-foreground sm:hidden">Pagos:</span>
                                                        −{formatMoney(period.payments, selectedAccount.currency)}
                                                    </p>
                                                    <p className={`font-semibold sm:text-right ${TONE_TEXT[toneOf(period.netDebtChange, { inverted: true })]}`}>
                                                        <span className="mr-1 text-xs font-normal text-muted-foreground sm:hidden">Variación:</span>
                                                        {formatSignedMoney(period.netDebtChange, selectedAccount.currency)}
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
                                                    className="grid gap-3 px-4 py-3.5 text-sm tabular-nums sm:grid-cols-[minmax(0,1fr)_repeat(3,8rem)] sm:items-center sm:gap-6 sm:px-5"
                                                >
                                                    <p className="font-medium first-letter:uppercase">{period.label}</p>
                                                    <p className={`${TONE_TEXT.positive} sm:text-right`}>+{formatMoney(period.incomes, selectedAccount.currency)}</p>
                                                    <p className={`${TONE_TEXT.negative} sm:text-right`}>−{formatMoney(period.expenses, selectedAccount.currency)}</p>
                                                    <p className={`font-semibold sm:text-right ${TONE_TEXT[toneOf(period.net)]}`}>
                                                        {formatSignedMoney(period.net, selectedAccount.currency)}
                                                    </p>
                                                </article>
                                            )) : (
                                                <p className="p-5 text-sm text-muted-foreground">
                                                    No hay flujo previsto para esta cuenta en el horizonte elegido.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </ForecastPanel>

                                <ForecastPanel>
                                    <ForecastPanelHeader
                                        className={visibleEvents.length ? undefined : "border-b-0"}
                                        title="Línea de tiempo"
                                        description={visibleEvents.length
                                            ? `${visibleEvents.length} compromiso${visibleEvents.length === 1 ? "" : "s"} entre ${formatAppDate(startsAt, { day: "numeric", month: "short" })} y ${formatAppDate(endsAt, { day: "numeric", month: "short", year: "numeric" })}.`
                                            : "No hay movimientos previstos en el rango seleccionado."}
                                        action={<CalendarClock className="hidden size-5 shrink-0 text-muted-foreground sm:block" />}
                                    />
                                    {visibleEvents.length > 0 && timelineGroups.map((group) => {
                                        const periodKey = `${granularity}:${group.key}`;
                                        const isExpanded = !group.label || expandedPeriods.has(periodKey);
                                        const focusedAccountId = group.label ? expandedPeriods.get(periodKey) ?? null : null;
                                        const shownItems = focusedAccountId
                                            ? group.items.filter((item) => itemTouchesAccount(item, focusedAccountId))
                                            : group.items;
                                        const periodSummaries = summarizeTimelinePeriod(group.items, accountTypes, summaryMerges);
                                        const periodYields = [...periodSummaries
                                            .filter((summary) => summary.yields > 0)
                                            .reduce((totals, summary) => {
                                                const currency = forecast.accounts.find((account) => account.id === summary.accountId)?.currency ?? "MXN";
                                                const current = totals.get(currency) ?? { currency, amount: 0, accounts: 0 };
                                                return totals.set(currency, { currency, amount: current.amount + summary.yields, accounts: current.accounts + 1 });
                                            }, new Map<string, { currency: string; amount: number; accounts: number }>())
                                            .values()];
                                        const movementCount = group.items.reduce((total, item) => total + (item.kind === "event" ? 1 : item.days), 0);

                                        const periodAnchor = `timeline-period-${periodKey}`;
                                        const dayAnchors = new Map<string, string>();
                                        const anchoredDays = new Set<string>();
                                        for (const item of group.label ? [] : group.items) {
                                            if (item.kind !== "event") continue;
                                            const dayKey = getPeriod(item.event.scheduledAt, "day").key;
                                            if (anchoredDays.has(dayKey)) continue;
                                            anchoredDays.add(dayKey);
                                            dayAnchors.set(item.event.id, `timeline-day-${dayKey}`);
                                        }

                                        return (
                                            <div key={group.key}>
                                                {group.label && (
                                                    <div
                                                        id={periodAnchor}
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
                                                        className={`w-full scroll-mt-36 cursor-pointer border-b px-4 py-3 text-left transition-colors duration-700 sm:px-5 ${highlightedAnchor === periodAnchor
                                                            ? "bg-primary/15"
                                                            : "bg-muted/40 hover:bg-muted/70"
                                                            }`}
                                                    >
                                                        <span className="flex items-center gap-2 text-sm font-medium">
                                                            <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                                            <span className="inline-block flex-1 first-letter:uppercase">{group.label}</span>
                                                            {periodYields.map((total) => (
                                                                <span
                                                                    key={total.currency}
                                                                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${TONE_SURFACE.positive}`}
                                                                >
                                                                    <span className="hidden sm:inline">Rendimiento total </span>
                                                                    +{formatMoney(total.amount, total.currency)}
                                                                    {total.accounts > 1 && <span className="hidden font-normal opacity-80 sm:inline"> · {total.accounts} cajitas</span>}
                                                                </span>
                                                            ))}
                                                            <span className="shrink-0 text-xs font-normal text-muted-foreground">
                                                                {movementCount} movimiento{movementCount === 1 ? "" : "s"}
                                                            </span>
                                                        </span>
                                                        <PeriodAccountSummaries
                                                            summaries={periodSummaries}
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
                                                            ? renderTimelineEvent(item.event, undefined, dayAnchors.get(item.event.id))
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
                                </ForecastPanel>

                                {visibleDismissedCardPayments.length > 0 && (
                                    <ForecastPanel>
                                        <ForecastPanelHeader
                                            title="Pagos omitidos"
                                            description="No cuentan en la previsión; puedes volver a incluirlos cuando quieras."
                                        />
                                        <div className="divide-y">
                                            {visibleDismissedCardPayments.map((payment) => {
                                                const card = accounts.find((account) => account.id === payment.creditAccountId);
                                                const key = `${payment.creditAccountId}:${payment.dueAt.toISOString()}`;
                                                return (
                                                    <div key={key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
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
                                    </ForecastPanel>
                                )}
                            </div>
                        </div>
                        <aside className="contents xl:sticky xl:top-28 xl:block xl:max-h-[calc(100vh-8.5rem)] xl:space-y-6 xl:overflow-y-auto xl:-m-1 xl:p-1 xl:scrollbar-thin xl:dock-top:top-[calc(var(--dock-space)+7rem)]">
                            <div className="order-1 min-w-0">
                                <ForecastKeyFigures
                                    liquidity={liquiditySummaries}
                                    debts={cardDebts}
                                    startsAt={startsAt}
                                />
                            </div>
                            <div className="order-3 min-w-0">
                                <section className="space-y-3">
                                    <div className="flex items-baseline justify-between px-1">
                                        <h2 className="text-sm font-medium">Cuentas</h2>
                                        <p className="text-xs text-muted-foreground">Clic para enfocar</p>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                                        {accountCards.map((account, index) => {
                                            const hasAlert = alertedAccountIds.has(account.id);
                                            const isCredit = account.type === "credit";
                                            const isFocused = focusedAccount?.id === account.id;

                                            return (
                                                <motion.article
                                                    key={account.id}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-pressed={isFocused}
                                                    onClick={() => toggleFocus(account.id)}
                                                    onKeyDown={(keyEvent) => {
                                                        if (keyEvent.target !== keyEvent.currentTarget) return;
                                                        if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
                                                        keyEvent.preventDefault();
                                                        toggleFocus(account.id);
                                                    }}
                                                    initial={{ opacity: 0, y: 12 }}
                                                    animate={{ opacity: focusedAccount && !isFocused ? 0.55 : 1, y: 0 }}
                                                    whileHover={{ opacity: 1 }}
                                                    transition={{ opacity: { duration: 0.2 }, y: { delay: index * 0.04 } }}
                                                    className={`flex cursor-pointer flex-col rounded-2xl border bg-card p-4 outline-none transition-[box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-ring ${isFocused
                                                        ? "border-primary/50 ring-2 ring-primary/30"
                                                        : "hover:border-foreground/20"
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate font-medium">{account.name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {account.fundingAccountId
                                                                    ? `Cajita de ${accounts.find((item) => item.id === account.fundingAccountId)?.name ?? "otra cuenta"}`
                                                                    : `${isCredit ? "Deuda proyectada" : "Saldo proyectado"} · ${account.currency}`}
                                                            </p>
                                                        </div>
                                                        {hasAlert && <AlertTriangle className={`size-4 shrink-0 ${TONE_TEXT.warning}`} />}
                                                    </div>
                                                    <Amount
                                                        value={account.projectedBalance}
                                                        currency={account.currency}
                                                        tone={!isCredit && account.projectedBalance < 0 ? "negative" : undefined}
                                                        className="mt-4 block text-2xl font-semibold tracking-tight"
                                                    />
                                                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                                                        <span className={TONE_TEXT[toneOf(account.projectedBalance - account.currentBalance, { inverted: isCredit })]}>
                                                            {formatSignedMoney(account.projectedBalance - account.currentBalance, account.currency)}
                                                        </span>
                                                        {" "}vs. hoy
                                                        {isCredit && account.creditLimit !== null
                                                            ? ` · Límite ${formatMoney(account.creditLimit, account.currency)}`
                                                            : ""
                                                        }
                                                    </p>
                                                    {isCredit && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(clickEvent) => {
                                                                clickEvent.stopPropagation();
                                                                setCardToConfigure({
                                                                    ...account,
                                                                    calculatedStatementBalance: account.calculatedStatementBalance ?? null,
                                                                    statementItems: account.statementItems,
                                                                });
                                                            }}
                                                            className="mt-3 -ml-2 self-start cursor-pointer text-muted-foreground"
                                                        >
                                                            <Settings2 className="size-3.5" />
                                                            Plan de pago
                                                        </Button>
                                                    )}
                                                </motion.article>
                                            );
                                        })}
                                    </div>
                                </section>
                            </div>
                        </aside>
                    </div>

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
                        className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs tabular-nums ring-1 transition-colors ${focusedAccountId === account.id
                            ? "bg-background ring-foreground/30"
                            : "bg-background/60 ring-transparent hover:bg-background"
                            }`}
                    >
                        <span className="block font-medium">{nameOf(account.id)}</span>
                        <span className="mt-0.5 block text-muted-foreground">
                            {figures.map((figure) => `${figure.label} ${figure.sign}${formatMoney(figure.value, account.currency)}`).join(" · ")}
                            {summary.closingBalance !== null && (
                                <>
                                    {figures.length ? " · " : ""}
                                    <span className="text-foreground">
                                        {isCredit ? "Deuda al cierre" : "Cierre"} {formatMoney(summary.closingBalance, account.currency)}
                                    </span>
                                </>
                            )}
                            {summary.mergedBalances.map((merged) => (
                                ` · En ${nameOf(merged.accountId)} ${formatMoney(merged.balance, account.currency)}`
                            ))}
                        </span>
                    </button>
                );
            })}
        </span>
    );
}
