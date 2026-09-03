import { toAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";
import type { RecurringRuleFormData } from "../schemas/recurring-rule.schema";

export function createRecurringRuleDraft(
    accounts: Array<{ id: string }>,
): Partial<RecurringRuleFormData> {
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

    return {
        transactionType: "expense",
        accountId: accounts[0]?.id ?? "",
        categoryId: "",
        frequency: "monthly",
        amountStrategy: "fixed",
        fifthOccurrencePolicy: "keep_fixed",
        name: "",
        periodTotal: undefined,
        fifthOccurrenceAmount: undefined,
        semimonthlyFirstDay: 15,
        semimonthlySecondDay: 0,
        calendarEntries: [],
        dateOverrides: [],
        startsAt: toAppDateTimeInputValue(oneHourFromNow) as unknown as Date,
        endsAt: undefined,
        notes: "",
    };
}

export function toRecurringRuleDraft(rule: {
    id: string;
    accountId: string;
    categoryId: string | null;
    transactionType: "income" | "expense";
    frequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "yearly" | "custom";
    amountStrategy: "fixed" | "period_total" | "custom_per_occurrence";
    fifthOccurrencePolicy: "keep_fixed" | "distribute_monthly_total" | "custom_amount";
    name: string;
    amount: number;
    periodTotal: number | null;
    fifthOccurrenceAmount: number | null;
    semimonthlyFirstDay: number | null;
    semimonthlySecondDay: number | null;
    calendarEntries: Array<{ scheduledAt: Date; amount?: number }>;
    dateOverrides: Array<{ originalScheduledAt: Date; scheduledAt: Date; amount?: number }>;
    startsAt: Date;
    endsAt: Date | null;
    notes: string | null;
}): RecurringRuleFormData {
    return {
        id: rule.id,
        accountId: rule.accountId,
        categoryId: rule.categoryId ?? "",
        transactionType: rule.transactionType,
        frequency: rule.frequency,
        amountStrategy: rule.amountStrategy,
        fifthOccurrencePolicy: rule.fifthOccurrencePolicy,
        name: rule.name,
        amount: rule.amount,
        periodTotal: rule.periodTotal ?? undefined,
        fifthOccurrenceAmount: rule.fifthOccurrenceAmount ?? undefined,
        semimonthlyFirstDay: rule.semimonthlyFirstDay ?? undefined,
        semimonthlySecondDay: rule.semimonthlySecondDay ?? undefined,
        calendarEntries: rule.calendarEntries.map((entry) => ({
            scheduledAt: toAppDateTimeInputValue(entry.scheduledAt) as unknown as Date,
            amount: entry.amount,
        })),
        dateOverrides: rule.dateOverrides.map((entry) => ({
            originalScheduledAt: toAppDateTimeInputValue(entry.originalScheduledAt) as unknown as Date,
            scheduledAt: toAppDateTimeInputValue(entry.scheduledAt) as unknown as Date,
            amount: entry.amount,
        })),
        startsAt: toAppDateTimeInputValue(rule.startsAt) as unknown as Date,
        endsAt: rule.endsAt
            ? toAppDateTimeInputValue(rule.endsAt) as unknown as Date
            : undefined,
        notes: rule.notes ?? "",
    };
}
