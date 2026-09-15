import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "@/src/db";
import {
    creditCardPaymentSettings, financialAccounts, financingInstallments,
    financingPlans, recurringRules, scheduledOccurrences, budgets, transactions,
    creditCardPaymentDismissals,
} from "@/src/db/schema";
import { getLatestCycleClose, isAppCalendarDateBefore } from "../domain/credit-card-cycle";
import { getOccurrencesInHorizon } from "@/src/features/recurring-movements/domain/recurrence-calculator";
import type { ForecastAccount, ForecastEvent } from "../domain/forecast-calculator";

const FORECAST_DAYS = 180;

type StoredCalendarEntry = { scheduledAt: string; amount?: number };
type StoredDateOverride = StoredCalendarEntry & { originalScheduledAt: string };

export async function getForecastData(userId: string, now = new Date()) {
    const until = new Date(now.getTime() + FORECAST_DAYS * 24 * 60 * 60 * 1000);
    const [accounts, occurrences, cardPaymentSettings, rules, forecastBudgets, completedTransactions, dismissedCardPayments] = await Promise.all([
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
            amount: transactions.amount,
            currency: transactions.currency,
            merchant: transactions.merchant,
            date: transactions.date,
        })
            .from(transactions)
            .where(and(
                eq(transactions.userId, userId),
                eq(transactions.status, "completed"),
                eq(transactions.type, "expense"),
                // Las compras financiadas se proyectan mediante sus cuotas;
                // incluir la compra completa duplicaría el compromiso.
                isNull(transactions.financingPlanId),
            )),
        db.select({
            creditAccountId: creditCardPaymentDismissals.creditAccountId,
            dueAt: creditCardPaymentDismissals.dueAt,
        })
            .from(creditCardPaymentDismissals)
            .where(eq(creditCardPaymentDismissals.userId, userId)),
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

    events.push(...completedTransactions
        .filter((transaction) => {
            const card = creditCardsById.get(transaction.accountId);
            return card !== undefined && isAppCalendarDateBefore(
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

    return {
        now,
        accounts: accounts.map((account) => ({
            ...account,
            currentBalance: Number(account.currentBalance),
            creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
            statementBalance: account.statementBalance === null ? null : Number(account.statementBalance),
            minimumPayment: account.minimumPayment === null ? null : Number(account.minimumPayment),
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
        events,
    };
}

export type ForecastData = Awaited<ReturnType<typeof getForecastData>>;
