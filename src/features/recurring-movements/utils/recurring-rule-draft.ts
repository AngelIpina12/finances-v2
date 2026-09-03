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
        name: "",
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
    frequency: "weekly" | "biweekly" | "monthly" | "yearly";
    name: string;
    amount: number;
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
        name: rule.name,
        amount: rule.amount,
        startsAt: toAppDateTimeInputValue(rule.startsAt) as unknown as Date,
        endsAt: rule.endsAt
            ? toAppDateTimeInputValue(rule.endsAt) as unknown as Date
            : undefined,
        notes: rule.notes ?? "",
    };
}
