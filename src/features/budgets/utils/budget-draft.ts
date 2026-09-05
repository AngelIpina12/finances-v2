import { toAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";
import type { BudgetsData } from "../queries/get-budgets";
import type { BudgetFormData } from "../schemas/budget.schema";

export function createBudgetDraft(): BudgetFormData {
    return {
        name: "",
        amount: 0,
        currency: "MXN",
        period: "monthly",
        rollover: "disabled",
        isReusable: true,
        color: "#2563eb",
        warningThreshold: 80,
        startsAt: toAppDateTimeInputValue(new Date()) as unknown as Date,
        endsAt: undefined,
        allocations: [],
    };
}

export function toBudgetDraft(budget: BudgetsData["budgets"][number]): BudgetFormData {
    return {
        id: budget.id,
        name: budget.name,
        amount: budget.amount,
        currency: budget.currency,
        period: budget.period,
        rollover: budget.rollover,
        isReusable: budget.isReusable,
        color: budget.color,
        warningThreshold: budget.warningThreshold,
        startsAt: toAppDateTimeInputValue(budget.startsAt) as unknown as Date,
        endsAt: budget.endsAt
            ? toAppDateTimeInputValue(budget.endsAt) as unknown as Date
            : undefined,
        allocations: budget.allocations.map(({ categoryId, amount }) => ({ categoryId, amount })),
    };
}
