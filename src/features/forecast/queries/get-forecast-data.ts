import { and, asc, eq, gte, isNull, lt, lte } from "drizzle-orm";
import { db } from "@/src/db";
import {
    creditCardPaymentSettings, financialAccounts, financingInstallments,
    financingPlans, recurringRules, scheduledOccurrences, budgets, transactions, fixedIncomePositions,
    creditCardPaymentDismissals,
} from "@/src/db/schema";
import { occurrenceHasLiveRule } from "@/src/features/scheduled/infrastructure/live-rule-occurrence";
import { getLatestCycleClose, isAppCalendarDateBefore } from "../domain/credit-card-cycle";
import { calculateCardStatement } from "../domain/card-statement-calculator";
import { getOccurrencesInHorizon } from "@/src/features/recurring-movements/domain/recurrence-calculator";
import type { ForecastAccount, ForecastEvent } from "../domain/forecast-calculator";
import type { LinkedSavings } from "../domain/linked-savings";
import { calculateAccruedInterest, calculateNetInterest, calculateProjectedDailyNetInterest } from "@/src/features/fixed-income/domain/fixed-income-calculator";
import { addAppCalendarDays } from "@/src/shared/utils/local-date-time";

const FORECAST_DAYS = 180;

type StoredCalendarEntry = { scheduledAt: string; amount?: number };
type StoredDateOverride = StoredCalendarEntry & { originalScheduledAt: string };

export async function getForecastData(userId: string, now = new Date()) {
    const until = new Date(now.getTime() + FORECAST_DAYS * 24 * 60 * 60 * 1000);
    const [accounts, occurrences, cardPaymentSettings, rules, forecastBudgets, completedTransactions, dismissedCardPayments, fixedIncome] = await Promise.all([
        db
            .select({
                id: financialAccounts.id,
                name: financialAccounts.name,
                type: financialAccounts.type,
                currency: financialAccounts.currency,
                currentBalance: financialAccounts.currentBalance,
                creditLimit: financialAccounts.creditLimit,
                billingDate: financialAccounts.billingDate,
                statementBalance: financialAccounts.statementBalance,
                minimumPayment: financialAccounts.minimumPayment,
                includeInLiquidity: financialAccounts.includeInLiquidity,
            })
            .from(financialAccounts)
            .where(and(
                eq(financialAccounts.userId, userId),
                eq(financialAccounts.isActive, true),
                isNull(financialAccounts.deletedAt),
            ))
            .orderBy(asc(financialAccounts.name)),
        db
            .select({
                id: scheduledOccurrences.id,
                source: scheduledOccurrences.source,
                financingPaymentAccountId: financingPlans.paymentAccountId,
                recurringRuleId: scheduledOccurrences.recurringRuleId,
                sequence: scheduledOccurrences.sequence,
                accountId: scheduledOccurrences.accountId,
                transactionType: scheduledOccurrences.transactionType,
                status: scheduledOccurrences.status,
                name: scheduledOccurrences.name,
                amount: scheduledOccurrences.amount,
                currency: scheduledOccurrences.currency,
                scheduledAt: scheduledOccurrences.scheduledAt,
            })
            .from(scheduledOccurrences)
            .leftJoin(
                financingInstallments,
                eq(scheduledOccurrences.financingInstallmentId, financingInstallments.id),
            )
            .leftJoin(financingPlans, eq(financingInstallments.financingPlanId, financingPlans.id))
            .where(and(
                eq(scheduledOccurrences.userId, userId),
                gte(scheduledOccurrences.scheduledAt, now),
                lt(scheduledOccurrences.scheduledAt, until),
                occurrenceHasLiveRule,
            )),
        db
            .select({
                creditAccountId: creditCardPaymentSettings.creditAccountId,
                sourceAccountId: creditCardPaymentSettings.sourceAccountId,
                strategy: creditCardPaymentSettings.strategy,
                fixedAmount: creditCardPaymentSettings.fixedAmount,
                paymentTermDays: creditCardPaymentSettings.paymentTermDays,
                includeInForecast: creditCardPaymentSettings.includeInForecast,
            })
            .from(creditCardPaymentSettings)
            .where(eq(creditCardPaymentSettings.userId, userId)),
        db
            .select({
                id: recurringRules.id,
                accountId: recurringRules.accountId,
                transactionType: recurringRules.transactionType,
                frequency: recurringRules.frequency,
                amountStrategy: recurringRules.amountStrategy,
                fifthOccurrencePolicy: recurringRules.fifthOccurrencePolicy,
                name: recurringRules.name,
                amount: recurringRules.amount,
                periodTotal: recurringRules.periodTotal,
                fifthOccurrenceAmount: recurringRules.fifthOccurrenceAmount,
                currency: recurringRules.currency,
                semimonthlyFirstDay: recurringRules.semimonthlyFirstDay,
                semimonthlySecondDay: recurringRules.semimonthlySecondDay,
                calendarEntries: recurringRules.calendarEntries,
                dateOverrides: recurringRules.dateOverrides,
                startsAt: recurringRules.startsAt,
                endsAt: recurringRules.endsAt,
            })
            .from(recurringRules)
            .where(and(
                eq(recurringRules.userId, userId),
                eq(recurringRules.isActive, true),
                isNull(recurringRules.deletedAt),
            )),
        db.select({ id: budgets.id, name: budgets.name, amount: budgets.amount, currency: budgets.currency, startsAt: budgets.startsAt, endsAt: budgets.endsAt, forecastAccountId: budgets.forecastAccountId })
            .from(budgets)
            .where(and(eq(budgets.userId, userId), eq(budgets.isActive, true), eq(budgets.includeInForecast, true), eq(budgets.period, "monthly"), isNull(budgets.deletedAt))),
        db.select({
            id: transactions.id,
            accountId: transactions.accountId,
            type: transactions.type,
            transferDirection: transactions.transferDirection,
            financingPlanId: transactions.financingPlanId,
            amount: transactions.amount,
            currency: transactions.currency,
            merchant: transactions.merchant,
            date: transactions.date,
        })
            .from(transactions)
            .where(and(
                eq(transactions.userId, userId),
                eq(transactions.status, "completed"),
            )),
        db.select({
            creditAccountId: creditCardPaymentDismissals.creditAccountId,
            dueAt: creditCardPaymentDismissals.dueAt,
        })
            .from(creditCardPaymentDismissals)
            .where(eq(creditCardPaymentDismissals.userId, userId)),
        db.select().from(fixedIncomePositions).where(and(
            eq(fixedIncomePositions.userId, userId),
            eq(fixedIncomePositions.status, "active"),
            lte(fixedIncomePositions.startsAt, until),
        )),
    ]);

    const activeAccountIds = new Set(accounts.map((account) => account.id));
    const existingRecurringKeys = new Set(
        occurrences
            .filter((occurrence) => occurrence.recurringRuleId && occurrence.sequence !== null)
            .map((occurrence) => `${occurrence.recurringRuleId}:${occurrence.sequence}`),
    );
    const events: ForecastEvent[] = occurrences
        .filter((occurrence) => (
            occurrence.status === "scheduled"
            && activeAccountIds.has(occurrence.accountId)
        ))
        .map((occurrence) => ({
            id: occurrence.id,
            accountId: occurrence.accountId,
            source: occurrence.source === "financing_installment"
                ? "financing"
                : occurrence.source === "recurring_rule"
                    ? "recurring"
                    : "scheduled",
            name: occurrence.name,
            amount: Number(occurrence.amount),
            currency: occurrence.currency as ForecastEvent["currency"],
            scheduledAt: occurrence.scheduledAt,
            transactionType: occurrence.transactionType as ForecastEvent["transactionType"],
            // La deuda MSI ya forma parte del saldo de la tarjeta. En Forecast la
            // cuota sólo alimenta el pago de tarjeta de su vencimiento, sin duplicar
            // un cargo ni una salida directa desde la cuenta de pago.
            affectsBalance: occurrence.source !== "financing_installment",
        }));

    const creditCardsById = new Map(accounts
        .filter((account) => account.type === "credit" && account.billingDate !== null)
        .map((account) => [account.id, account]));

    const calculatedStatementBalances = new Map<string, number>();
    for (const card of creditCardsById.values()) {
        const { calculatedStatementBalance } = calculateCardStatement({
            cardId: card.id,
            billingDate: card.billingDate!,
            paymentTermDays: cardPaymentSettings.find((setting) => (
                setting.creditAccountId === card.id
            ))?.paymentTermDays ?? 0,
            now,
            transactions: completedTransactions.map((transaction) => ({
                accountId: transaction.accountId,
                type: transaction.type,
                transferDirection: transaction.transferDirection,
                financingPlanId: transaction.financingPlanId,
                amount: Number(transaction.amount),
                date: transaction.date,
            })),
            installmentOccurrences: occurrences.map((occurrence) => ({
                accountId: occurrence.accountId,
                source: occurrence.source,
                status: occurrence.status,
                scheduledAt: occurrence.scheduledAt,
                amount: Number(occurrence.amount),
            })),
        });
        if (calculatedStatementBalance !== null) {
            calculatedStatementBalances.set(card.id, calculatedStatementBalance);
        }
    }

    events.push(...completedTransactions
        .filter((transaction) => {
            const card = creditCardsById.get(transaction.accountId);
            return card !== undefined
                && transaction.type === "expense"
                && transaction.financingPlanId === null
                && isAppCalendarDateBefore(
                getLatestCycleClose(now, card.billingDate!),
                transaction.date,
            );
        })
        .map((transaction) => ({
            id: `posted-card-charge:${transaction.id}`,
            accountId: transaction.accountId,
            source: "posted_card_charge" as const,
            name: transaction.merchant || "Cargo registrado en tarjeta",
            amount: Number(transaction.amount),
            currency: transaction.currency as ForecastEvent["currency"],
            scheduledAt: transaction.date,
            transactionType: "expense" as const,
            affectsBalance: false,
        })));

    for (const rule of rules) {
        if (!activeAccountIds.has(rule.accountId)) continue;

        const calendarEntries = rule.calendarEntries as StoredCalendarEntry[];
        const dateOverrides = rule.dateOverrides as StoredDateOverride[];
        const generated = getOccurrencesInHorizon({
            startsAt: rule.startsAt,
            endsAt: rule.endsAt,
            frequency: rule.frequency as Parameters<typeof getOccurrencesInHorizon>[0]["frequency"],
            amount: Number(rule.amount),
            amountStrategy: rule.amountStrategy as Parameters<typeof getOccurrencesInHorizon>[0]["amountStrategy"],
            periodTotal: rule.periodTotal === null ? null : Number(rule.periodTotal),
            fifthOccurrencePolicy: rule.fifthOccurrencePolicy as Parameters<typeof getOccurrencesInHorizon>[0]["fifthOccurrencePolicy"],
            fifthOccurrenceAmount: rule.fifthOccurrenceAmount === null ? null : Number(rule.fifthOccurrenceAmount),
            semimonthlyFirstDay: rule.semimonthlyFirstDay,
            semimonthlySecondDay: rule.semimonthlySecondDay,
            calendarEntries: calendarEntries.map((entry) => ({
                scheduledAt: new Date(entry.scheduledAt), amount: entry.amount,
            })),
            dateOverrides: dateOverrides.map((entry) => ({
                originalScheduledAt: new Date(entry.originalScheduledAt),
                scheduledAt: new Date(entry.scheduledAt),
                amount: entry.amount,
            })),
        }, now, until);

        events.push(...generated
            .filter((occurrence) => !existingRecurringKeys.has(`${rule.id}:${occurrence.sequence}`))
            .map((occurrence) => ({
                id: `recurring:${rule.id}:${occurrence.sequence}`,
                accountId: rule.accountId,
                source: "recurring" as const,
                name: rule.name,
                amount: occurrence.amount,
                currency: rule.currency as ForecastEvent["currency"],
                scheduledAt: occurrence.scheduledAt,
                transactionType: rule.transactionType as ForecastEvent["transactionType"],
                affectsBalance: true,
            })));
    }

    for (const budget of forecastBudgets) {
        if (!budget.forecastAccountId || !activeAccountIds.has(budget.forecastAccountId)) continue;
        const account = accounts.find((item) => item.id === budget.forecastAccountId);
        if (!account || account.currency !== budget.currency) continue;
        const anchor = new Date(budget.startsAt);
        for (let index = 0; ; index += 1) {
            const scheduledAt = new Date(now.getFullYear(), now.getMonth() + index, Math.min(anchor.getDate(), 28), anchor.getHours(), anchor.getMinutes());
            if (scheduledAt < now || scheduledAt < anchor) continue;
            if (scheduledAt >= until || (budget.endsAt && scheduledAt >= budget.endsAt)) break;
            events.push({ id: `budget:${budget.id}:${scheduledAt.toISOString()}`, accountId: budget.forecastAccountId, source: "budget", name: `Presupuesto estimado · ${budget.name}`, amount: Number(budget.amount), currency: budget.currency as ForecastEvent["currency"], scheduledAt, transactionType: "expense", affectsBalance: true });
        }
    }

    const linkedSavings: LinkedSavings[] = [];
    for (const position of fixedIncome) {
        if (!activeAccountIds.has(position.settlementAccountId)) continue;
        const principal = Number(position.outstandingPrincipal);
        // Una cajita disponible al instante vive dentro de su cuenta de fondeo:
        // de ahí sale el capital y ahí regresan los retiros. Su rendimiento
        // diario se reinvierte en la cajita, no se deposita en la cuenta.
        const fundingAccount = accounts.find((account) => account.id === position.fundingAccountId);
        const isLinkedSavings = position.isAvailableOnDemand
            && fundingAccount !== undefined
            && fundingAccount.currency === position.currency;
        if (isLinkedSavings) {
            linkedSavings.push({
                positionId: position.id,
                accountId: position.fundingAccountId,
                name: position.name,
                currency: position.currency as ForecastEvent["currency"],
                balance: principal,
            });
        }
        const rate = Number(position.annualRate);
        const withholding = Number(position.withholdingRate ?? 0);
        const projectionEnd = position.maturesAt && position.maturesAt < until
            ? position.maturesAt
            : until;
        if (position.interestFrequency === "daily") {
            const dates: Date[] = [];
            for (let date = new Date(now); date < projectionEnd; date = addAppCalendarDays(date, 1)) {
                dates.push(date);
            }
            const dailyInterests = calculateProjectedDailyNetInterest({
                principal,
                annualRate: rate,
                convention: position.dayCountConvention,
                withholdingRate: withholding,
                days: dates.length,
            });
            dates.forEach((date, index) => {
                const daily = dailyInterests[index] ?? 0;
                events.push({
                    id: `fixed-income-interest:${position.id}:${date.toISOString()}`,
                    accountId: isLinkedSavings ? position.fundingAccountId : position.settlementAccountId,
                    source: "fixed_income",
                    name: `Rendimiento estimado · ${position.name}`,
                    amount: daily,
                    currency: position.currency as ForecastEvent["currency"],
                    scheduledAt: date,
                    transactionType: "income",
                    affectsBalance: true,
                    linkedSavings: isLinkedSavings ? { positionId: position.id, kind: "yield" } : undefined,
                });
            });
        } else if (position.maturesAt) {
            const gross = calculateAccruedInterest({ principal: Number(position.principal), annualRate: rate, startsAt: position.startsAt, asOf: position.maturesAt, calculationMethod: position.calculationMethod, dayCountConvention: position.dayCountConvention }).gross;
            const net = calculateNetInterest(gross, withholding).net;
            events.push({ id: `fixed-income-interest:${position.id}:maturity`, accountId: position.settlementAccountId, source: "fixed_income", name: `Interés estimado al vencimiento · ${position.name}`, amount: net, currency: position.currency as ForecastEvent["currency"], scheduledAt: position.maturesAt, transactionType: "income", affectsBalance: true });
        }
        if (position.maturesAt && position.maturesAt < until) {
            events.push({
                id: `fixed-income-principal:${position.id}`,
                accountId: position.settlementAccountId,
                source: "fixed_income",
                name: `Capital al vencimiento · ${position.name}`,
                amount: principal,
                currency: position.currency as ForecastEvent["currency"],
                scheduledAt: position.maturesAt,
                transactionType: "income",
                affectsBalance: true,
                linkedSavings: isLinkedSavings ? { positionId: position.id, kind: "principal" } : undefined,
            });
        }
    }

    return {
        now,
        accounts: accounts.map((account) => ({
            ...account,
            currentBalance: Number(account.currentBalance),
            creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
            statementBalance: account.statementBalance === null ? null : Number(account.statementBalance),
            minimumPayment: account.minimumPayment === null ? null : Number(account.minimumPayment),
            calculatedStatementBalance: calculatedStatementBalances.get(account.id) ?? null,
            type: account.type as ForecastAccount["type"],
            currency: account.currency as ForecastEvent["currency"],
        })),
        cardPaymentSettings: cardPaymentSettings
            .filter((setting) => (
                activeAccountIds.has(setting.creditAccountId)
                && activeAccountIds.has(setting.sourceAccountId)
            ))
            .map((setting) => ({
                ...setting,
                fixedAmount: setting.fixedAmount === null ? null : Number(setting.fixedAmount),
                strategy: setting.strategy as "full_statement" | "minimum_payment" | "fixed_amount" | "manual",
            })),
        dismissedCardPaymentKeys: dismissedCardPayments.map((payment) => (
            `${payment.creditAccountId}:${payment.dueAt.toISOString()}`
        )),
        dismissedCardPayments,
        linkedSavings,
        events,
    };
}

export type ForecastData = Awaited<ReturnType<typeof getForecastData>>;
