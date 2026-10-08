import { and, asc, eq, gte, isNull, lt, lte } from "drizzle-orm";
import { db } from "@/src/db";
import {
    creditCardPaymentSettings, financialAccounts, financingInstallments,
    financingPlans, recurringRules, scheduledOccurrences,
    budgets, budgetAllocations, transactions, fixedIncomePositions,
    creditCardPaymentDismissals, forecastSavingsSimulations, forecastViews,
} from "@/src/db/schema";
import { occurrenceHasLiveRule } from "@/src/features/scheduled/infrastructure/live-rule-occurrence";
import { getLatestCycleClose, isAppCalendarDateBefore } from "../domain/credit-card-cycle";
import { calculateCardStatement, type CardStatementItem } from "../domain/card-statement-calculator";
import { getOccurrencesInHorizon } from "@/src/features/recurring-movements/domain/recurrence-calculator";
import type { ForecastAccount, ForecastEvent } from "../domain/forecast-calculator";
import { buildBudgetForecastEvents } from "../domain/budget-forecast";
import type { LinkedSavings } from "../domain/linked-savings";
import { getValidSweepRules } from "../domain/savings-sweep";
import type { SavedForecastView } from "../domain/forecast-view";
import { getForecastHorizonEnd } from "../domain/forecast-horizon";
import {
    calculateAccruedInterest, calculateNetInterest, calculateProjectedDailyNetInterest
} from "@/src/features/fixed-income/domain/fixed-income-calculator";
import { addAppCalendarDays } from "@/src/shared/utils/local-date-time";


type StoredCalendarEntry = { scheduledAt: string; amount?: number };
type StoredDateOverride = StoredCalendarEntry & { originalScheduledAt: string };

export async function getForecastData(userId: string, now = new Date()) {
    const until = getForecastHorizonEnd();
    const [
        accounts, occurrences, cardPaymentSettings,
        rules, forecastBudgets, completedTransactions,
        dismissedCardPayments, fixedIncome, savedSimulations,
        savedViews, forecastBudgetAllocations,
    ] = await Promise.all([
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
        db
            .select({
                id: budgets.id,
                name: budgets.name,
                amount: budgets.amount,
                currency: budgets.currency,
                startsAt: budgets.startsAt,
                endsAt: budgets.endsAt,
                isReusable: budgets.isReusable,
                forecastAccountId: budgets.forecastAccountId
            })
            .from(budgets)
            .where(and(
                eq(budgets.userId, userId),
                eq(budgets.isActive, true),
                eq(budgets.includeInForecast, true),
                eq(budgets.period, "monthly"),
                isNull(budgets.deletedAt)
            )),
        db
            .select({
                id: transactions.id,
                accountId: transactions.accountId,
                type: transactions.type,
                transferDirection: transactions.transferDirection,
                financingPlanId: transactions.financingPlanId,
                amount: transactions.amount,
                currency: transactions.currency,
                merchant: transactions.merchant,
                date: transactions.date,
                categoryId: transactions.categoryId,
                budgetAmount: transactions.budgetAmount,
            })
            .from(transactions)
            .where(and(
                eq(transactions.userId, userId),
                eq(transactions.status, "completed"),
            )),
        db
            .select({
                creditAccountId: creditCardPaymentDismissals.creditAccountId,
                dueAt: creditCardPaymentDismissals.dueAt,
            })
            .from(creditCardPaymentDismissals)
            .where(eq(creditCardPaymentDismissals.userId, userId)),
        db
            .select().from(fixedIncomePositions).where(and(
                eq(fixedIncomePositions.userId, userId),
                eq(fixedIncomePositions.status, "active"),
                lte(fixedIncomePositions.startsAt, until),
            )),
        db
            .select({
                id: forecastSavingsSimulations.id,
                name: forecastSavingsSimulations.name,
                rules: forecastSavingsSimulations.rules,
                isDefault: forecastSavingsSimulations.isDefault,
            })
            .from(forecastSavingsSimulations)
            .where(eq(forecastSavingsSimulations.userId, userId))
            .orderBy(asc(forecastSavingsSimulations.name)),
        db
            .select({
                id: forecastViews.id,
                name: forecastViews.name,
                rangePresetDays: forecastViews.rangePresetDays,
                startsOn: forecastViews.startsOn,
                endsOn: forecastViews.endsOn,
                currency: forecastViews.currency,
                accountKind: forecastViews.accountKind,
                accountIds: forecastViews.accountIds,
                granularity: forecastViews.granularity,
                savingsMode: forecastViews.savingsMode,
                chartView: forecastViews.chartView,
                savingsSimulationId: forecastViews.savingsSimulationId,
                isDefault: forecastViews.isDefault,
            })
            .from(forecastViews)
            .where(eq(forecastViews.userId, userId))
            .orderBy(asc(forecastViews.name)),
        db
            .select({
                budgetId: budgetAllocations.budgetId,
                categoryId: budgetAllocations.categoryId,
            })
            .from(budgetAllocations)
            .innerJoin(budgets, eq(budgetAllocations.budgetId, budgets.id))
            .where(and(
                eq(budgets.userId, userId),
                eq(budgets.includeInForecast, true),
                isNull(budgets.deletedAt),
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
            affectsBalance: occurrence.source !== "financing_installment",
        }));

    const creditCardsById = new Map(accounts
        .filter((account) => account.type === "credit" && account.billingDate !== null)
        .map((account) => [account.id, account]));

    const calculatedStatementBalances = new Map<string, number>();
    const statementItemsByCard = new Map<string, CardStatementItem[]>();
    for (const card of creditCardsById.values()) {
        const { calculatedStatementBalance, items } = calculateCardStatement({
            cardId: card.id,
            billingDate: card.billingDate!,
            paymentTermDays: cardPaymentSettings.find((setting) => (
                setting.creditAccountId === card.id
            ))?.paymentTermDays ?? 0,
            now,
            transactions: completedTransactions.map((transaction) => ({
                id: transaction.id,
                name: transaction.merchant,
                accountId: transaction.accountId,
                type: transaction.type,
                transferDirection: transaction.transferDirection,
                financingPlanId: transaction.financingPlanId,
                amount: Number(transaction.amount),
                date: transaction.date,
            })),
            installmentOccurrences: occurrences.map((occurrence) => ({
                id: occurrence.id,
                name: occurrence.name,
                accountId: occurrence.accountId,
                source: occurrence.source,
                status: occurrence.status,
                scheduledAt: occurrence.scheduledAt,
                amount: Number(occurrence.amount),
            })),
        });
        if (calculatedStatementBalance !== null) {
            calculatedStatementBalances.set(card.id, calculatedStatementBalance);
            statementItemsByCard.set(card.id, items);
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

    events.push(...buildBudgetForecastEvents({
        budgets: forecastBudgets.flatMap((budget) => {
            const account = accounts.find((item) => item.id === budget.forecastAccountId);
            if (!budget.forecastAccountId || !account || account.currency !== budget.currency) return [];

            return [{
                ...budget,
                forecastAccountId: budget.forecastAccountId,
                amount: Number(budget.amount),
                currency: budget.currency as ForecastEvent["currency"],
                categoryIds: forecastBudgetAllocations
                    .filter((allocation) => allocation.budgetId === budget.id)
                    .map((allocation) => allocation.categoryId),
            }];
        }),
        expenses: completedTransactions
            .filter((transaction) => transaction.type === "expense")
            .map((transaction) => ({
                categoryId: transaction.categoryId,
                currency: transaction.currency,
                date: transaction.date,
                amount: Number(transaction.budgetAmount ?? transaction.amount),
            })),
        now,
        until,
    }));

    const linkedSavings: LinkedSavings[] = [];

    for (const position of fixedIncome) {
        if (!activeAccountIds.has(position.settlementAccountId)) continue;
        const principal = Number(position.outstandingPrincipal);
        const rate = Number(position.annualRate);
        const withholding = Number(position.withholdingRate ?? 0);
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
                annualRate: rate,
                dayCountConvention: position.dayCountConvention,
                withholdingRate: withholding,
                hasDailyInterest: position.interestFrequency === "daily",
            });
        }
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
                    dailyYieldGroup: `fixed-income:${position.id}`,
                });
            });
        } else if (position.maturesAt) {
            const gross = calculateAccruedInterest({
                principal: Number(position.principal),
                annualRate: rate,
                startsAt: position.startsAt,
                asOf: position.maturesAt,
                calculationMethod: position.calculationMethod,
                dayCountConvention: position.dayCountConvention
            }).gross;
            const net = calculateNetInterest(gross, withholding).net;
            events.push({
                id: `fixed-income-interest:${position.id}:maturity`,
                accountId: position.settlementAccountId,
                source: "fixed_income",
                name: `Interés estimado al vencimiento · ${position.name}`,
                amount: net,
                currency: position.currency as ForecastEvent["currency"],
                scheduledAt: position.maturesAt,
                transactionType: "income",
                affectsBalance: true
            });
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
            statementItems: statementItemsByCard.get(account.id),
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
        savingsSimulations: savedSimulations
            .map((simulation) => ({
                ...simulation,
                rules: getValidSweepRules(simulation.rules.map((rule) => ({
                    ...rule,
                    minimumBalance: Number(rule.minimumBalance),
                })), linkedSavings),
            }))
            .filter((simulation) => simulation.rules.length > 0),
        savedViews: savedViews.map((view) => view as SavedForecastView),
        events,
    };
}

export type ForecastData = Awaited<ReturnType<typeof getForecastData>>;
