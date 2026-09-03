import { toAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";
import type { ScheduledOccurrenceFormData } from "../schemas/scheduled-occurrence.schema";

export function createScheduledOccurrenceDraft(
    accounts: Array<{ id: string }>,
): Partial<ScheduledOccurrenceFormData> {
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000);

    return {
        transactionType: "expense",
        accountId: accounts[0]?.id ?? "",
        categoryId: "",
        name: "",
        scheduledAt: toAppDateTimeInputValue(oneHourFromNow) as unknown as Date,
        notes: "",
    };
}
