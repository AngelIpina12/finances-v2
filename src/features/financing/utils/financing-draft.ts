import type {
    CompleteFinancingInstallmentData, FinancingPlanFormData,
} from "../schemas/financing.schema";
import type { FinancingData } from "../queries/get-financing-data";
import { toAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";

export function createFinancingPlanDraft(purchases: FinancingData["purchases"]): FinancingPlanFormData {
    const purchase = purchases[0];

    return {
        purchaseTransactionId: purchase?.id ?? "",
        name: purchase?.name ?? "",
        regularInstallmentCount: 1,
        regularInstallmentAmount: purchase?.amount ?? 0,
        balloonAmount: 0,
        startsAt: toAppDateTimeInputValue(new Date()) as unknown as Date,
    };
}

export function createFinancingPaymentDraft(
    installmentId: string,
    accounts: FinancingData["paymentAccounts"],
): CompleteFinancingInstallmentData {
    return {
        installmentId,
        sourceAccountId: accounts[0]?.id ?? "",
    };
}
