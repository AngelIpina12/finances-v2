import type {
    ForecastAccount, ProjectedForecastEvent,
} from "./forecast-calculator";

export type LiquidityRangeSummary = {
    currency: ForecastAccount["currency"];
    today: number;
    starting: number;
    incomes: number;
    directExpenses: number;
    cardPayments: number;
    financingPayments: number;
    minimum: number;
    ending: number;
    firstNegativeAt: Date | null;
};

function liquidDelta(
    event: ProjectedForecastEvent,
    accountsById: Map<string, ForecastAccount>,
) {
    if (!event.affectsBalance || !event.accountId) return 0;

    const account = accountsById.get(event.accountId);
    if (!account?.includeInLiquidity || account.currency !== event.currency) return 0;

    return event.transactionType === "income" ? event.amount : -event.amount;
}

export function buildLiquidityRangeSummaries(input: {
    accounts: ForecastAccount[];
    events: ProjectedForecastEvent[];
    startsAt: Date;
    endsAt: Date;
    currency?: ForecastAccount["currency"];
}) {
    const accountsById = new Map(input.accounts.map((account) => [account.id, account]));
    const currencies = [...new Set(input.accounts
        .filter((account) => (
            account.includeInLiquidity
            && (!input.currency || account.currency === input.currency)
        ))
        .map((account) => account.currency))];

    return currencies.map((currency): LiquidityRangeSummary => {
        const today = input.accounts
            .filter((account) => account.includeInLiquidity && account.currency === currency)
            .reduce((sum, account) => sum + account.currentBalance, 0);
        const priorDelta = input.events
            .filter((event) => event.currency === currency && event.scheduledAt < input.startsAt)
            .reduce((sum, event) => sum + liquidDelta(event, accountsById), 0);
        const rangeEvents = input.events.filter((event) => (
            event.currency === currency
            && event.scheduledAt >= input.startsAt
            && event.scheduledAt < input.endsAt
        ));
        const starting = today + priorDelta;
        let running = starting;
        let minimum = starting;
        let firstNegativeAt: Date | null = starting < 0 ? input.startsAt : null;
        let incomes = 0;
        let directExpenses = 0;
        let cardPayments = 0;
        let financingPayments = 0;

        for (const event of rangeEvents) {
            const delta = liquidDelta(event, accountsById);
            if (delta === 0) continue;

            running += delta;
            minimum = Math.min(minimum, running);
            if (running < 0 && firstNegativeAt === null) firstNegativeAt = event.scheduledAt;

            if (delta > 0) incomes += delta;
            else if (event.source === "card_payment") cardPayments += Math.abs(delta);
            else if (event.source === "financing") financingPayments += Math.abs(delta);
            else directExpenses += Math.abs(delta);
        }

        return {
            currency,
            today,
            starting,
            incomes,
            directExpenses,
            cardPayments,
            financingPayments,
            minimum,
            ending: running,
            firstNegativeAt,
        };
    });
}
