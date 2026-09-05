export type BudgetProgressStatus = "healthy" | "warning" | "exceeded";

export function calculateBudgetProgress(input: {
    amount: number;
    spent: number;
    allocatedAmount: number;
    warningThreshold: number;
}) {
    const usage = input.amount > 0 ? input.spent / input.amount * 100 : 0;
    const status: BudgetProgressStatus = usage >= 100
        ? "exceeded"
        : usage >= input.warningThreshold
            ? "warning"
            : "healthy";

    return {
        usage,
        remaining: input.amount - input.spent,
        unallocatedAmount: Math.max(0, input.amount - input.allocatedAmount),
        status,
    };
}
