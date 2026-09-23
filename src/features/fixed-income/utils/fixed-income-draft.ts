import { toAppDateInputValue } from "@/src/shared/utils/local-date-time";
import type { FixedIncomeData } from "../queries/get-fixed-income-data";
import type { FixedIncomePositionData } from "../schemas/fixed-income.schema";

export function createFixedIncomeDraft(
    accounts: FixedIncomeData["liquidAccounts"],
): FixedIncomePositionData {
    const fundingAccount = accounts[0];
    const now = new Date();

    return {
        name: "",
        institution: "",
        fundingAccountId: fundingAccount?.id ?? "",
        settlementAccountId: fundingAccount?.id ?? "",
        principal: 0,
        annualRate: 0.1,
        calculationMethod: "simple",
        dayCountConvention: "actual_365",
        interestFrequency: "daily",
        withholdingRate: 0,
        startsAt: toAppDateInputValue(now) as unknown as Date,
        maturesAt: undefined,
        isAvailableOnDemand: true,
        autoRenew: false,
    };
}

export function toFixedIncomeDraft(
    position: FixedIncomeData["positions"][number],
): FixedIncomePositionData {
    return {
        name: position.name,
        institution: position.institution ?? "",
        fundingAccountId: position.fundingAccountId,
        settlementAccountId: position.settlementAccountId,
        principal: position.principal,
        annualRate: position.annualRate,
        calculationMethod: position.calculationMethod,
        dayCountConvention: position.dayCountConvention,
        interestFrequency: position.interestFrequency,
        withholdingRate: position.withholdingRate,
        startsAt: position.startsAt,
        maturesAt: position.maturesAt ?? undefined,
        isAvailableOnDemand: position.isAvailableOnDemand,
        autoRenew: position.autoRenew,
    };
}
