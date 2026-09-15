import {
    startOfDay, startOfMonth, startOfWeek, subMonths
} from "date-fns";
import { getBalanceDelta } from "@/src/features/transactions/domain/transaction-rules";
import type { AccountType, Currency } from "@/src/features/transactions/domain/transaction-repository";
import {
    getCycleCloseForCharge, getLatestCycleClose, getPaymentDueAt,
    isAppCalendarDateBefore,
} from "./credit-card-cycle";

export type ForecastAccount = {
    id: string;
    name: string;
    type: AccountType;
    currency: Currency;
    currentBalance: number;
    creditLimit: number | null;
    billingDate: number | null;
    statementBalance: number | null;
    minimumPayment: number | null;
    includeInLiquidity: boolean;
};

export type ForecastEventSource = "scheduled" | "recurring" | "financing" | "budget" | "posted_card_charge" | "card_payment";

export type ForecastEvent = {
    id: string;
    accountId: string | null;
    source: ForecastEventSource;
    name: string;
    amount: number;
    currency: Currency;
    scheduledAt: Date;
    transactionType: "income" | "expense";
    affectsBalance: boolean;
    settlesAccountId?: string | null;
    isOverdue?: boolean;
    cardPaymentDueAt?: Date;
    cardPaymentBreakdown?: {
        statementBalance: number;
        trackedInstallments: number;
        untrackedStatement: number;
        projectedCharges: number;
        expectedPayment: number | null;
        closesAt: Date | null;
    };
};

export type CardPaymentSetting = {
    creditAccountId: string;
    sourceAccountId: string;
    strategy: "full_statement" | "minimum_payment" | "fixed_amount" | "manual";
    fixedAmount: number | null;
    paymentTermDays: number;
    includeInForecast: boolean;
};

export type ForecastAlert = {
    accountId: string;
    kind: "insufficient_funds" | "credit_limit" | "overdue_payment";
    scheduledAt: Date;
    amount: number;
};

export type ProjectedForecastEvent = ForecastEvent & {
    balanceAfter: number | null;
    settledBalanceAfter: number | null;
    liquidityAfter: number | null;
};

function expectedPaymentAmount(input: {
    strategy: CardPaymentSetting["strategy"];
    amount: number;
    minimumPayment: number | null;
    fixedAmount: number | null;
}) {
    if (input.strategy === "manual") return null;
    if (input.strategy === "minimum_payment") {
        return Math.min(input.amount, input.minimumPayment ?? input.amount);
    }
    if (input.strategy === "fixed_amount") {
        return Math.min(input.amount, input.fixedAmount ?? 0);
    }
    return input.amount;
}

export function buildCardPaymentEvents(input: {
    accounts: ForecastAccount[];
    events: ForecastEvent[];
    settings: CardPaymentSetting[];
    dismissedCardPaymentKeys?: string[];
    now: Date;
    until: Date;
}) {
    const accountsById = new Map(input.accounts.map((account) => [account.id, account]));
    const dismissedPaymentKeys = new Set(input.dismissedCardPaymentKeys);
    const payments: ForecastEvent[] = [];

    for (const setting of input.settings) {
        if (!setting.includeInForecast) continue;

        const card = accountsById.get(setting.creditAccountId);
        const source = accountsById.get(setting.sourceAccountId);
        if (!card || !source || card.type !== "credit" || card.currency !== source.currency || !card.billingDate) {
            continue;
        }

        const currentDueAt = getPaymentDueAt(
            getLatestCycleClose(input.now, card.billingDate),
            setting.paymentTermDays,
        );
        const isOverdue = isAppCalendarDateBefore(currentDueAt, input.now);
        const dueAt = isOverdue ? input.now : currentDueAt;
        const trackedInstallments = input.events
            .filter((event) => (
                event.source === "financing"
                && event.accountId === card.id
                && event.scheduledAt <= dueAt
            ))
            .reduce((sum, event) => sum + event.amount, 0);
        const untrackedStatement = card.statementBalance ?? 0;
        const currentPayment = expectedPaymentAmount({
            strategy: setting.strategy,
            amount: untrackedStatement,
            minimumPayment: card.minimumPayment,
            fixedAmount: setting.fixedAmount,
        });

        const currentPaymentKey = `${card.id}:${currentDueAt.toISOString()}`;
        if (dueAt < input.until && currentPayment !== null && currentPayment > 0 && !dismissedPaymentKeys.has(currentPaymentKey)) {
            payments.push({
                id: `card-statement:${card.id}:${dueAt.toISOString()}`,
                accountId: source.id,
                settlesAccountId: card.id,
                source: "card_payment",
                name: `Pago de estado de cuenta · ${card.name}`,
                amount: currentPayment,
                currency: card.currency,
                scheduledAt: dueAt,
                transactionType: "expense",
                affectsBalance: true,
                isOverdue,
                cardPaymentDueAt: currentDueAt,
                cardPaymentBreakdown: {
                    statementBalance: card.statementBalance ?? 0,
                    trackedInstallments,
                    untrackedStatement,
                    projectedCharges: 0,
                    expectedPayment: currentPayment,
                    closesAt: getLatestCycleClose(input.now, card.billingDate),
                },
            });
        } else if (
            dueAt < input.until
            && setting.strategy === "manual"
            && untrackedStatement > 0
            && !dismissedPaymentKeys.has(currentPaymentKey)
        ) {
            payments.push({
                id: `card-statement:${card.id}:${dueAt.toISOString()}`,
                accountId: null,
                settlesAccountId: card.id,
                source: "card_payment",
                name: `Pago de estado de cuenta · ${card.name}`,
                amount: untrackedStatement,
                currency: card.currency,
                scheduledAt: dueAt,
                transactionType: "expense",
                affectsBalance: false,
                isOverdue,
                cardPaymentDueAt: currentDueAt,
                cardPaymentBreakdown: {
                    statementBalance: card.statementBalance ?? 0,
                    trackedInstallments,
                    untrackedStatement,
                    projectedCharges: 0,
                    expectedPayment: null,
                    closesAt: getLatestCycleClose(input.now, card.billingDate),
                },
            });
        }

        const chargesByDueDate = new Map<string, { dueAt: Date; closesAt: Date; amount: number }>();
        for (const event of input.events) {
            if (
                event.accountId !== card.id
                || event.transactionType !== "expense"
                || event.source === "card_payment"
            ) continue;
            // El estado actual ya contiene las MSI exigibles antes de su vencimiento.
            if (event.source === "financing" && event.scheduledAt <= currentDueAt) continue;

            // La fecha almacenada de MSI era su antigua fecha de cuota. Para
            // proyectarla como parte del estado, se asigna al corte previo y
            // se usa el mismo vencimiento calculado que el resto de cargos.
            const closesAt = getCycleCloseForCharge(
                event.source === "financing" ? subMonths(event.scheduledAt, 1) : event.scheduledAt,
                card.billingDate,
            );
            const cycleDueAt = getPaymentDueAt(closesAt, setting.paymentTermDays);
            const key = cycleDueAt.toISOString();
            const cycle = chargesByDueDate.get(key) ?? { dueAt: cycleDueAt, closesAt, amount: 0 };
            cycle.amount += event.amount;
            chargesByDueDate.set(key, cycle);
        }

        for (const cycle of chargesByDueDate.values()) {
            const cycleDueAt = cycle.dueAt;
            if (cycleDueAt < input.now || cycleDueAt >= input.until) continue;
            const cyclePaymentKey = `${card.id}:${cycleDueAt.toISOString()}`;
            if (dismissedPaymentKeys.has(cyclePaymentKey)) continue;

            const amount = expectedPaymentAmount({
                strategy: setting.strategy,
                amount: cycle.amount,
                minimumPayment: card.minimumPayment,
                fixedAmount: setting.fixedAmount,
            });
            if (amount === null) {
                payments.push({
                    id: `card-cycle:${card.id}:${cycle.closesAt.toISOString()}`,
                    accountId: null,
                    settlesAccountId: card.id,
                    source: "card_payment",
                    name: `Compromiso proyectado · ${card.name}`,
                    amount: cycle.amount,
                    currency: card.currency,
                    scheduledAt: cycleDueAt,
                    transactionType: "expense",
                    affectsBalance: false,
                    cardPaymentDueAt: cycleDueAt,
                    cardPaymentBreakdown: {
                        statementBalance: 0,
                        trackedInstallments: 0,
                        untrackedStatement: 0,
                        projectedCharges: cycle.amount,
                        expectedPayment: null,
                        closesAt: cycle.closesAt,
                    },
                });
                continue;
            }
            if (amount <= 0) continue;

            payments.push({
                id: `card-cycle:${card.id}:${cycleDueAt.toISOString()}`,
                accountId: source.id,
                settlesAccountId: card.id,
                source: "card_payment",
                name: `Pago proyectado · ${card.name}`,
                amount,
                currency: card.currency,
                scheduledAt: cycleDueAt,
                transactionType: "expense",
                affectsBalance: true,
                cardPaymentDueAt: cycleDueAt,
                cardPaymentBreakdown: {
                    statementBalance: 0,
                    trackedInstallments: 0,
                    untrackedStatement: 0,
                    projectedCharges: cycle.amount,
                    expectedPayment: amount,
                    closesAt: cycle.closesAt,
                },
            });
        }
    }

    return payments;
}

export function buildForecast(input: {
    accounts: ForecastAccount[];
    events: ForecastEvent[];
    settings?: CardPaymentSetting[];
    dismissedCardPaymentKeys?: string[];
    now: Date;
    days: number;
}) {
    const until = new Date(input.now.getTime() + input.days * 24 * 60 * 60 * 1000);
    const accountsById = new Map(input.accounts.map((account) => [account.id, account]));
    const balances = new Map(input.accounts.map((account) => [account.id, account.currentBalance]));
    const alerts: ForecastAlert[] = [];
    const liquidityPoints: Array<{
        occurredAt: Date;
        accountId: string;
        currency: Currency;
        delta: number;
        totalAfter: number;
    }> = [];
    const baseEvents = input.events.filter((event) => event.scheduledAt >= input.now && event.scheduledAt < until);
    // Los cargos ya registrados ya están reflejados en el saldo actual de la
    // tarjeta. Se usan sólo para calcular el pago de su ciclo, no como un
    // movimiento futuro que vuelva a modificar ese saldo.
    const postedCardCharges = input.events.filter((event) => event.source === "posted_card_charge");
    const eventsToProject = [
        ...baseEvents.filter((event) => event.source !== "financing"),
        ...buildCardPaymentEvents({
            accounts: input.accounts,
            events: [...baseEvents, ...postedCardCharges],
            settings: input.settings ?? [],
            dismissedCardPaymentKeys: input.dismissedCardPaymentKeys,
            now: input.now,
            until,
        }),
    ];

    function totalLiquidity(currency: Currency) {
        return input.accounts
            .filter((account) => account.includeInLiquidity && account.currency === currency)
            .reduce((sum, account) => sum + (balances.get(account.id) ?? account.currentBalance), 0);
    }

    function applyBalanceChange(
        account: ForecastAccount,
        transactionType: ForecastEvent["transactionType"],
        amount: number,
        scheduledAt: Date,
    ) {
        const currentBalance = balances.get(account.id) ?? account.currentBalance;
        const delta = getBalanceDelta({ ...account, owedAmount: null }, transactionType, amount);
        const balanceAfter = currentBalance + delta;
        balances.set(account.id, balanceAfter);

        if (account.type === "credit" && account.creditLimit !== null && balanceAfter > account.creditLimit) {
            alerts.push({
                accountId: account.id,
                kind: "credit_limit",
                scheduledAt,
                amount: balanceAfter - account.creditLimit,
            });
        }

        if (account.type !== "credit" && balanceAfter < 0) {
            alerts.push({
                accountId: account.id,
                kind: "insufficient_funds",
                scheduledAt,
                amount: Math.abs(balanceAfter),
            });
        }

        if (account.includeInLiquidity) {
            liquidityPoints.push({
                occurredAt: scheduledAt,
                accountId: account.id,
                currency: account.currency,
                delta,
                totalAfter: totalLiquidity(account.currency),
            });
        }

        return balanceAfter;
    }

    const events = eventsToProject
        .sort((left, right) => (
            left.scheduledAt.getTime() - right.scheduledAt.getTime()
            || left.name.localeCompare(right.name)
        ))
        .map((event): ProjectedForecastEvent => {
            const account = event.accountId ? accountsById.get(event.accountId) : undefined;

            if (event.isOverdue && event.settlesAccountId) {
                alerts.push({
                    accountId: event.settlesAccountId,
                    kind: "overdue_payment",
                    scheduledAt: event.scheduledAt,
                    amount: event.amount,
                });
            }

            if (!event.affectsBalance || !account || account.currency !== event.currency) {
                return {
                    ...event,
                    balanceAfter: null,
                    settledBalanceAfter: null,
                    liquidityAfter: null,
                };
            }

            const balanceAfter = applyBalanceChange(account, event.transactionType, event.amount, event.scheduledAt);
            const settledAccount = event.settlesAccountId
                ? accountsById.get(event.settlesAccountId)
                : undefined;

            const settledBalanceAfter = settledAccount && settledAccount.currency === event.currency
                ? applyBalanceChange(settledAccount, "income", event.amount, event.scheduledAt)
                : null;

            return {
                ...event,
                balanceAfter,
                settledBalanceAfter,
                liquidityAfter: account.includeInLiquidity ? totalLiquidity(account.currency) : null,
            };
        });

    const accountSummaries = input.accounts.map((account) => ({
        ...account,
        projectedBalance: balances.get(account.id) ?? account.currentBalance,
    }));
    const liquidity = [...new Set(input.accounts
        .filter((account) => account.includeInLiquidity)
        .map((account) => account.currency))]
        .map((currency) => {
            const starting = input.accounts
                .filter((account) => account.includeInLiquidity && account.currency === currency)
                .reduce((sum, account) => sum + account.currentBalance, 0);
            const points = liquidityPoints.filter((point) => point.currency === currency);
            return {
                currency,
                starting,
                projected: totalLiquidity(currency),
                minimum: points.reduce((minimum, point) => Math.min(minimum, point.totalAfter), starting),
            };
        });

    return { until, events, accounts: accountSummaries, alerts, liquidity, liquidityPoints };
}

export type ForecastGranularity = "day" | "week" | "month";

function getPeriod(date: Date, granularity: ForecastGranularity) {
    const periodStart = granularity === "day"
        ? startOfDay(date)
        : granularity === "week"
            ? startOfWeek(date, { weekStartsOn: 1 })
            : startOfMonth(date);
    const label = granularity === "day"
        ? date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
        : granularity === "week"
            ? `Semana del ${periodStart.toLocaleDateString("es-MX", { day: "numeric", month: "short" })}`
            : date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });

    return { key: periodStart.toISOString(), label };
}

export function buildCashFlow(events: ProjectedForecastEvent[], granularity: ForecastGranularity) {
    const groups = new Map<string, { label: string; incomes: number; expenses: number }>();

    for (const event of events) {
        if (!event.affectsBalance) continue;

        const { key, label } = getPeriod(event.scheduledAt, granularity);
        const group = groups.get(key) ?? { label, incomes: 0, expenses: 0 };

        if (event.transactionType === "income") group.incomes += event.amount;
        else group.expenses += event.amount;
        groups.set(key, group);
    }

    return [...groups.values()].map((group) => ({ ...group, net: group.incomes - group.expenses }));
}

export function buildCreditDebtActivity(
    events: ProjectedForecastEvent[],
    creditAccountId: string,
    granularity: ForecastGranularity,
) {
    const groups = new Map<string, { label: string; charges: number; payments: number }>();

    for (const event of events) {
        if (!event.affectsBalance) continue;

        const isDirectCardMovement = event.accountId === creditAccountId;
        const settlesCard = event.settlesAccountId === creditAccountId;
        if (!isDirectCardMovement && !settlesCard) continue;

        const { key, label } = getPeriod(event.scheduledAt, granularity);
        const group = groups.get(key) ?? { label, charges: 0, payments: 0 };

        if (settlesCard || (isDirectCardMovement && event.transactionType === "income")) {
            group.payments += event.amount;
        } else if (isDirectCardMovement && event.transactionType === "expense") {
            group.charges += event.amount;
        }
        groups.set(key, group);
    }

    return [...groups.values()].map((group) => ({
        ...group,
        netDebtChange: group.charges - group.payments,
    }));
}
