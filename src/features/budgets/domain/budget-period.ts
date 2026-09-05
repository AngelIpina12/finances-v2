import {
    addMonths, addQuarters,
    addWeeks, addYears,
} from "date-fns";

export type BudgetPeriodType = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
export type RolloverType = "disabled" | "carry_remaining" | "carry_deficit";

export type BudgetPeriodRange = {
    start: Date;
    end: Date;
};

export function getBudgetPeriodRanges(input: {
    period: BudgetPeriodType;
    startsAt: Date;
    endsAt: Date | null;
    isReusable: boolean;
}, through: Date): BudgetPeriodRange[] {
    if (input.startsAt > through) return [];
    if (input.period === "custom") {
        return input.endsAt ? [{ start: input.startsAt, end: input.endsAt }] : [];
    }

    const ranges: BudgetPeriodRange[] = [];
    let start = input.startsAt;

    while (start <= through && ranges.length < 2400) {
        const end = input.period === "weekly"
            ? addWeeks(start, 1)
            : input.period === "quarterly"
                ? addQuarters(start, 1)
                : input.period === "yearly"
                    ? addYears(start, 1)
                    : addMonths(start, 1);

        ranges.push({ start, end });
        if (!input.isReusable) break;
        start = end;
    }

    return ranges;
}

export function getRolloverAmount(type: RolloverType, previousRemaining: number) {
    if (type === "carry_remaining") return Math.max(0, previousRemaining);
    if (type === "carry_deficit") return Math.min(0, previousRemaining);
    return 0;
}
