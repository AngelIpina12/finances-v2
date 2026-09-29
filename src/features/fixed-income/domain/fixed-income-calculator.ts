export type CalculationMethod = "simple" | "compound";
export type DayCountConvention = "actual_360" | "actual_365";

const MS_PER_DAY = 86_400_000;

function utcDay(date: Date) {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function calendarDaysBetween(start: Date, end: Date) {
    return Math.max(0, Math.round((utcDay(end) - utcDay(start)) / MS_PER_DAY));
}

export function dayCountBase(convention: DayCountConvention) {
    return convention === "actual_360" ? 360 : 365;
}

export function roundMoney(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateAccruedInterest(input: {
    principal: number;
    annualRate: number;
    startsAt: Date;
    asOf: Date;
    calculationMethod: CalculationMethod;
    dayCountConvention: DayCountConvention;
}) {
    const days = calendarDaysBetween(input.startsAt, input.asOf);
    const base = dayCountBase(input.dayCountConvention);
    const gross = input.calculationMethod === "compound"
        ? input.principal * ((1 + input.annualRate / base) ** days - 1)
        : input.principal * input.annualRate * days / base;

    return { days, gross: roundMoney(gross) };
}

export function calculateDailyInterest(principal: number, annualRate: number, convention: DayCountConvention) {
    return roundMoney(principal * annualRate / dayCountBase(convention));
}

export function calculateNetInterest(grossAmount: number, withholdingRate = 0) {
    const tax = roundMoney(grossAmount * withholdingRate);
    return { tax, net: roundMoney(grossAmount - tax) };
}

export function calculateProjectedDailyNetInterest(input: {
    principal: number;
    annualRate: number;
    convention: DayCountConvention;
    withholdingRate?: number;
    days: number;
}) {
    let outstandingPrincipal = input.principal;

    return Array.from({ length: input.days }, () => {
        const gross = calculateDailyInterest(
            outstandingPrincipal,
            input.annualRate,
            input.convention,
        );
        const { net } = calculateNetInterest(gross, input.withholdingRate);
        outstandingPrincipal = roundMoney(outstandingPrincipal + net);
        return net;
    });
}
