import type { TransactionFormData } from "../schemas/transaction.schema";
import { toLocalDateTimeInputValue } from "@/src/shared/utils/local-date-time";

type AccountOption = {
    id: string;
};

export function createTransactionDraft(
    accounts: AccountOption[],
): Partial<TransactionFormData> {
    return {
        type: "expense",
        accountId: accounts[0]?.id ?? "",
        categoryId: "",
        // datetime-local expects YYYY-MM-DDTHH:mm without a timezone suffix.
        date: toLocalDateTimeInputValue() as unknown as Date,
        merchant: "",
        notes: "",
    };
}
