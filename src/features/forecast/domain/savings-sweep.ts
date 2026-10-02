import {
    calculateDailyInterest, calculateNetInterest, roundMoney,
} from "@/src/features/fixed-income/domain/fixed-income-calculator";
import { addAppCalendarDays } from "@/src/shared/utils/local-date-time";
import {
    buildForecast, type CardPaymentSetting, type ForecastAccount,
    type ForecastEvent,
} from "./forecast-calculator";
import {
    applyLinkedSavings, toSavingsAccount, type LinkedSavings,
    type LinkedSavingsMode,
} from "./linked-savings";

export type SavingsSweepRule = {
    accountId: string;
    positionId: string;
    minimumBalance: number;
};

export function simulatedSavingsAccountId(positionId: string) {
    return `simulated-savings:${positionId}`;
}

export function getSweepableSavings(savings: LinkedSavings[], accountId: string) {
    return savings.filter((saving) => saving.accountId === accountId && saving.hasDailyInterest);
}

type Flow = { at: Date; delta: number };

export function applySavingsSweep(input: {
    accounts: ForecastAccount[];
    events: ForecastEvent[];
    savings: LinkedSavings[];
    mode: LinkedSavingsMode;
    rule: SavingsSweepRule;
    settings: CardPaymentSetting[];
    dismissedCardPaymentKeys: string[];
    now: Date;
    days: number;
}) {
    const saving = input.savings.find((item) => (
        item.positionId === input.rule.positionId && item.accountId === input.rule.accountId
    ));
    const account = input.accounts.find((item) => item.id === input.rule.accountId);
    const base = applyLinkedSavings({
        accounts: input.accounts,
        events: input.events.filter((event) => event.linkedSavings?.positionId !== input.rule.positionId),
        savings: input.savings.filter((item) => item.positionId !== input.rule.positionId),
        mode: input.mode,
    });

    if (!saving || !saving.hasDailyInterest || !account || account.currency !== saving.currency) return base;

    const savingsAccountId = simulatedSavingsAccountId(saving.positionId);
    const savingsAccount = toSavingsAccount(saving, savingsAccountId, `${saving.name} (simulada)`);

    const firstPass = buildForecast({
        accounts: base.accounts,
        events: base.events,
        settings: input.settings,
        dismissedCardPaymentKeys: input.dismissedCardPaymentKeys,
        now: input.now,
        days: input.days,
    });

    const flows: Flow[] = [];

    for (const event of firstPass.events) {
        if (event.accountId === account.id && event.balanceAfter !== null) {
            flows.push({ at: event.scheduledAt, delta: event.transactionType === "income" ? event.amount : -event.amount });
        }
        if (event.settlesAccountId === account.id && event.settledBalanceAfter !== null) {
            flows.push({ at: event.scheduledAt, delta: event.amount });
        }
    }

    const until = new Date(input.now.getTime() + input.days * 24 * 60 * 60 * 1000);
    const yieldDates: Date[] = [];

    for (let date = input.now; date < until; date = addAppCalendarDays(date, 1)) yieldDates.push(date);

    const simulated: ForecastEvent[] = [];
    const minimumBalance = Math.max(0, input.rule.minimumBalance);
    let accountBalance = account.currentBalance;
    let savingsBalance = saving.balance;
    let flowIndex = 0;

    function transfer(at: Date, amount: number, toSavings: boolean) {
        simulated.push({
            id: `savings-sweep:${toSavings ? "in" : "out"}:${at.toISOString()}:${simulated.length}`,
            accountId: toSavings ? account!.id : savingsAccountId,
            settlesAccountId: toSavings ? savingsAccountId : account!.id,
            source: "savings_simulation",
            name: toSavings ? `Traspaso simulado a ${saving!.name}` : `Retiro simulado de ${saving!.name}`,
            amount,
            currency: saving!.currency,
            scheduledAt: at,
            transactionType: "expense",
            affectsBalance: true,
        });
    }

    function applyFlow(flow: Flow) {
        if (flow.delta > 0) {
            accountBalance = roundMoney(accountBalance + flow.delta);
            const excess = roundMoney(accountBalance - minimumBalance);
            if (excess > 0) {
                transfer(new Date(flow.at.getTime() + 1), excess, true);
                accountBalance = minimumBalance;
                savingsBalance = roundMoney(savingsBalance + excess);
            }
            return;
        }

        const shortfall = roundMoney(minimumBalance - (accountBalance + flow.delta));
        const withdrawal = Math.min(Math.max(shortfall, 0), savingsBalance);
        if (withdrawal > 0) {
            transfer(new Date(Math.max(flow.at.getTime() - 1, input.now.getTime())), withdrawal, false);
            accountBalance = roundMoney(accountBalance + withdrawal);
            savingsBalance = roundMoney(savingsBalance - withdrawal);
        }
        accountBalance = roundMoney(accountBalance + flow.delta);
    }

    for (const yieldDate of yieldDates) {
        while (flowIndex < flows.length && flows[flowIndex].at < yieldDate) applyFlow(flows[flowIndex++]);

        const gross = calculateDailyInterest(savingsBalance, saving.annualRate, saving.dayCountConvention);
        const { net } = calculateNetInterest(gross, saving.withholdingRate);
        if (net <= 0) continue;
        savingsBalance = roundMoney(savingsBalance + net);
        simulated.push({
            id: `savings-sweep:yield:${yieldDate.toISOString()}`,
            accountId: savingsAccountId,
            source: "savings_simulation",
            name: `Rendimiento simulado · ${saving.name}`,
            dailyYieldGroup: `simulated:${saving.positionId}`,
            amount: net,
            currency: saving.currency,
            scheduledAt: yieldDate,
            transactionType: "income",
            affectsBalance: true,
        });
    }
    while (flowIndex < flows.length) applyFlow(flows[flowIndex++]);

    return {
        accounts: [...base.accounts, savingsAccount],
        events: [...base.events, ...simulated],
    };
}
