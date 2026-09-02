import type { TransferFormData } from "../schemas/transfer.schema";
import { toAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";

export function createTransferDraft(
    accounts: Array<{ id: string; currency: string }>,
): Partial<TransferFormData> {
    const source = accounts[0];
    const destination = accounts.find(
        (account) => account.id !== source?.id && account.currency === source?.currency,
    );

    return {
        sourceAccountId: source?.id ?? "",
        destinationAccountId: destination?.id ?? "",
        date: toAppDateTimeInputValue() as unknown as Date,
        description: "",
        notes: "",
    };
}
