import { addAppCalendarDays, formatAppDate } from "@/src/shared/utils/local-date-time";
import {
    getPeriod, type ForecastAccount, type ForecastGranularity,
    type ProjectedForecastEvent,
} from "./forecast-calculator";

export type ForecastTimelineMeasure = "balance" | "debt";

export type ForecastTimelinePoint = {
    key: string;
    label: string;
    tooltipLabel: string;
    balance: number;
    incomes: number;
    expenses: number;
    balanceChange: number | null;
    periodIncomes: number;
    periodExpenses: number;
    yields: number;
    periodYields: number;
};

function roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function selectTimelineAccounts<T extends Pick<ForecastAccount, "type">>(accounts: T[]) {
    const assets = accounts.filter((account) => account.type !== "credit");
    return {
        accounts: assets.length ? assets : accounts,
        measure: (assets.length || !accounts.length ? "balance" : "debt") as ForecastTimelineMeasure,
    };
}

function shortLabel(date: Date, granularity: ForecastGranularity) {
    return granularity === "month"
        ? formatAppDate(date, { month: "short", year: "numeric" })
        : formatAppDate(date, { day: "numeric", month: "short" });
}

export function buildForecastTimeline(input: {
    accounts: ForecastAccount[];
    events: ProjectedForecastEvent[];
    accountIds: Set<string>;
    startsAt: Date;
    endsAt: Date;
    granularity: ForecastGranularity;
}) {
    const { accounts: scopedAccounts, measure } = selectTimelineAccounts(
        input.accounts.filter((account) => input.accountIds.has(account.id)),
    );
    const balances = new Map(scopedAccounts.map((account) => [account.id, account.currentBalance]));
    const events = [...input.events].sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime());
    let eventIndex = 0;
    let incomes = 0;
    let expenses = 0;
    let yields = 0;

    function currentValue() {
        return roundMoney(scopedAccounts.reduce((total, account) => {
            const balance = balances.get(account.id) ?? 0;
            return total + balance;
        }, 0));
    }

    function applyEventsBefore(until: Date, countFlows: boolean) {
        while (eventIndex < events.length && events[eventIndex].scheduledAt < until) {
            const event = events[eventIndex];
            eventIndex += 1;

            const inAccount = event.accountId !== null && balances.has(event.accountId);
            const inSettledAccount = event.settlesAccountId != null && balances.has(event.settlesAccountId);
            if (inAccount && event.balanceAfter !== null) balances.set(event.accountId!, event.balanceAfter);
            if (inSettledAccount && event.settledBalanceAfter !== null) {
                balances.set(event.settlesAccountId!, event.settledBalanceAfter);
            }

            if (!countFlows || !event.affectsBalance || (inAccount && inSettledAccount)) continue;
            if (inAccount) {
                if (event.dailyYieldGroup && event.transactionType === "income") yields += event.amount;
                if (event.transactionType === "income") incomes += event.amount;
                else expenses += event.amount;
            } else if (inSettledAccount) {
                incomes += event.amount;
            }
        }
    }

    applyEventsBefore(input.startsAt, false);
    const points: ForecastTimelinePoint[] = [{
        key: "start",
        label: "Inicio",
        tooltipLabel: `Inicio · ${formatAppDate(input.startsAt, { day: "numeric", month: "long" })}`,
        balance: currentValue(),
        incomes: 0,
        expenses: 0,
        balanceChange: null,
        periodIncomes: 0,
        periodExpenses: 0,
        yields: 0,
        periodYields: 0,
    }];
    let previous = points[0];

    let periodFirstDay: Date | null = null;
    let firstPeriodDays = 0;
    for (let day = input.startsAt; day < input.endsAt; day = addAppCalendarDays(day, 1)) {
        const nextDay = addAppCalendarDays(day, 1);
        const periodEnd = nextDay < input.endsAt ? nextDay : input.endsAt;
        const period = getPeriod(day, input.granularity);
        periodFirstDay ??= day;
        if (points.length === 1) firstPeriodDays += 1;
        applyEventsBefore(periodEnd, true);

        const closesPeriod = periodEnd >= input.endsAt || getPeriod(nextDay, input.granularity).key !== period.key;
        if (!closesPeriod) continue;

        const balance = currentValue();
        const point = {
            key: period.key,
            label: shortLabel(periodFirstDay, input.granularity),
            tooltipLabel: period.label,
            balance,
            incomes: roundMoney(incomes),
            expenses: roundMoney(expenses),
            balanceChange: roundMoney(balance - previous.balance),
            periodIncomes: roundMoney(incomes - previous.incomes),
            periodExpenses: roundMoney(expenses - previous.expenses),
            yields: roundMoney(yields),
            periodYields: roundMoney(yields - previous.yields),
        };
        points.push(point);
        previous = point;
        periodFirstDay = null;
    }

    if (input.granularity !== "day" && firstPeriodDays === 1 && points.length > 2) points.shift();

    return { measure, points };
}

export type ForecastTimelineItem<T extends ProjectedForecastEvent> =
    | { kind: "event"; event: T }
    | { kind: "daily_yield"; id: string; days: number; amount: number; firstAt: Date; last: T };

export function groupTimelineEvents<T extends ProjectedForecastEvent>(events: T[], granularity: ForecastGranularity) {
    if (granularity === "day") {
        return [{ key: "all", label: null, items: events.map((event): ForecastTimelineItem<T> => ({ kind: "event", event })) }];
    }

    const periods: Array<{ key: string; label: string | null; items: ForecastTimelineItem<T>[] }> = [];
    const yieldRows = new Map<string, Extract<ForecastTimelineItem<T>, { kind: "daily_yield" }>>();

    for (const event of events) {
        const period = getPeriod(event.scheduledAt, granularity);
        let group = periods.at(-1);
        if (group?.key !== period.key) {
            group = { key: period.key, label: period.label, items: [] };
            periods.push(group);
        }

        if (!event.dailyYieldGroup) {
            group.items.push({ kind: "event", event });
            continue;
        }

        const rowKey = `${period.key}:${event.dailyYieldGroup}`;
        const row = yieldRows.get(rowKey);
        if (row) {
            row.days += 1;
            row.amount = roundMoney(row.amount + event.amount);
            row.last = event;
            continue;
        }

        const created = {
            kind: "daily_yield" as const,
            id: `daily-yield:${rowKey}`,
            days: 1,
            amount: event.amount,
            firstAt: event.scheduledAt,
            last: event,
        };
        yieldRows.set(rowKey, created);
        group.items.push(created);
    }

    const itemTime = (item: ForecastTimelineItem<T>) => (
        item.kind === "event" ? item.event.scheduledAt : item.last.scheduledAt
    ).getTime();
    for (const period of periods) period.items.sort((left, right) => itemTime(left) - itemTime(right));

    return periods;
}

export type ForecastPeriodAccountSummary = {
    accountId: string;
    incomes: number;
    yields: number;
    expenses: number;
    transfersIn: number;
    transfersOut: number;
    closingBalance: number | null;
    mergedBalances: Array<{ accountId: string; balance: number }>;
};

export function summarizeTimelinePeriod<T extends ProjectedForecastEvent>(
    items: ForecastTimelineItem<T>[],
    accountTypes: Map<string, string>,
    mergeInto: Map<string, string> = new Map(),
) {
    const resolve = (accountId: string) => mergeInto.get(accountId) ?? accountId;
    const summaries = new Map<string, Omit<ForecastPeriodAccountSummary, "closingBalance" | "mergedBalances">>();
    const closings = new Map<string, number>();
    const summaryFor = (accountId: string) => {
        const existing = summaries.get(accountId);
        if (existing) return existing;
        const created = { accountId, incomes: 0, yields: 0, expenses: 0, transfersIn: 0, transfersOut: 0 };
        summaries.set(accountId, created);
        return created;
    };

    for (const item of items) {
        const event = item.kind === "event" ? item.event : item.last;
        const amount = item.kind === "event" ? item.event.amount : item.amount;
        if (!event.affectsBalance || !event.accountId || event.balanceAfter === null) continue;

        const source = summaryFor(resolve(event.accountId));
        closings.set(event.accountId, event.balanceAfter);
        const settledId = event.settlesAccountId;
        const settledType = settledId ? accountTypes.get(settledId) : undefined;

        if (settledId && settledType && event.settledBalanceAfter !== null) {
            closings.set(settledId, event.settledBalanceAfter);
            const settled = summaryFor(resolve(settledId));
            if (settled === source) continue;
            if (settledType === "credit") {
                source.expenses += amount;
                settled.incomes += amount;
            } else {
                source.transfersOut += amount;
                settled.transfersIn += amount;
            }
            continue;
        }

        if (event.dailyYieldGroup) source.yields += amount;
        else if (event.transactionType === "income") source.incomes += amount;
        else source.expenses += amount;
    }

    return [...summaries.values()].map((summary): ForecastPeriodAccountSummary => {
        const members = [...closings.entries()].filter(([accountId]) => resolve(accountId) === summary.accountId);
        return {
            ...summary,
            incomes: roundMoney(summary.incomes),
            yields: roundMoney(summary.yields),
            expenses: roundMoney(summary.expenses),
            transfersIn: roundMoney(summary.transfersIn),
            transfersOut: roundMoney(summary.transfersOut),
            closingBalance: closings.get(summary.accountId) ?? null,
            mergedBalances: members
                .filter(([accountId, balance]) => accountId !== summary.accountId && balance !== 0)
                .map(([accountId, balance]) => ({ accountId, balance })),
        };
    });
}
