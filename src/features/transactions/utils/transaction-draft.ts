import type { TransactionFormData } from "../schemas/transaction.schema";
import { toAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";

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
        date: toAppDateTimeInputValue() as unknown as Date,
        merchant: "",
        notes: "",
    };
}

export function toTransactionDraft(transaction: {
    id: string;
    accountId: string;
    categoryId: string | null;
    type: "income" | "expense";
    amount: string;
    date: Date;
    merchant: string | null;
    notes: string | null;
}): TransactionFormData {
    return {
        id: transaction.id,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId ?? "",
        type: transaction.type,
        amount: Number(transaction.amount),
        date: toAppDateTimeInputValue(transaction.date) as unknown as Date,
        merchant: transaction.merchant ?? "",
        notes: transaction.notes ?? "",
    };
}
