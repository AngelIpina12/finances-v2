import { and, asc, eq, gte, isNull, lt } from "drizzle-orm";
import { db } from "@/src/db";
import {
    financialAccounts, financingInstallments, financingPlans,
    recurringRules, scheduledOccurrences,
} from "@/src/db/schema";
import { getOccurrencesInHorizon } from "@/src/features/recurring-movements/domain/recurrence-calculator";
import type { ForecastAccount, ForecastEvent } from "../domain/forecast-calculator";

const FORECAST_DAYS = 90;

type StoredCalendarEntry = { scheduledAt: string; amount?: number };
type StoredDateOverride = StoredCalendarEntry & { originalScheduledAt: string };

export async function getForecastData(userId: string, now = new Date()) {
    const until = new Date(now.getTime() + FORECAST_DAYS * 24 * 60 * 60 * 1000);
    const [accounts, occurrences, rules] = await Promise.all([
        db
            .select({
                id: financialAccounts.id,
                name: financialAccounts.name,
                type: financialAccounts.type,
                currency: financialAccounts.currency,
                currentBalance: financialAccounts.currentBalance,
                creditLimit: financialAccounts.creditLimit,
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
    ]);

    const existingRecurringKeys = new Set(
        occurrences
            .filter((occurrence) => occurrence.recurringRuleId && occurrence.sequence !== null)
            .map((occurrence) => `${occurrence.recurringRuleId}:${occurrence.sequence}`),
    );
    const events: ForecastEvent[] = occurrences
        .filter((occurrence) => occurrence.status === "scheduled")
        .map((occurrence) => ({
            id: occurrence.id,
            accountId: occurrence.source === "financing_installment"
                ? occurrence.financingPaymentAccountId
                : occurrence.accountId,
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
            affectsBalance: occurrence.source !== "financing_installment"
                || occurrence.financingPaymentAccountId !== null,
            settlesAccountId: occurrence.source === "financing_installment"
                ? occurrence.accountId
                : null,
        }));

    for (const rule of rules) {
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

    return {
        now,
        accounts: accounts.map((account) => ({
            ...account,
            currentBalance: Number(account.currentBalance),
            creditLimit: account.creditLimit === null ? null : Number(account.creditLimit),
            type: account.type as ForecastAccount["type"],
            currency: account.currency as ForecastEvent["currency"],
        })),
        events,
    };
}

export type ForecastData = Awaited<ReturnType<typeof getForecastData>>;
