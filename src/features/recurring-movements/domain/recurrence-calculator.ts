import {
    addMonths, addWeeks, addYears,
    lastDayOfMonth,
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/src/shared/constants/date-time";

export type RecurrenceFrequency =
    | "weekly"
    | "biweekly"
    | "semimonthly"
    | "monthly"
    | "yearly"
    | "custom";
export type AmountStrategy = "fixed" | "period_total" | "custom_per_occurrence";
export type FifthOccurrencePolicy =
    | "keep_fixed"
    | "distribute_monthly_total"
    | "custom_amount";

export type CalendarEntry = {
    scheduledAt: Date;
    amount?: number;
};

export type DateOverride = CalendarEntry & {
    originalScheduledAt: Date;
};

export type RecurrenceSchedule = {
    startsAt: Date;
    endsAt: Date | null;
    frequency: RecurrenceFrequency;
    amount: number;
    amountStrategy: AmountStrategy;
    periodTotal: number | null;
    fifthOccurrencePolicy: FifthOccurrencePolicy;
    fifthOccurrenceAmount: number | null;
    semimonthlyFirstDay: number | null;
    semimonthlySecondDay: number | null;
    calendarEntries: CalendarEntry[];
    dateOverrides: DateOverride[];
};

export type GeneratedScheduleItem = {
    sequence: number;
    originalScheduledAt: Date;
    scheduledAt: Date;
    amount: number;
};

type Candidate = Omit<GeneratedScheduleItem, "amount"> & {
    amountOverride?: number;
};

function addFrequency(date: Date, frequency: Exclude<RecurrenceFrequency, "semimonthly" | "custom">) {
    const localDate = toZonedTime(date, APP_TIME_ZONE);
    const next = frequency === "weekly"
        ? addWeeks(localDate, 1)
        : frequency === "biweekly"
            ? addWeeks(localDate, 2)
            : frequency === "monthly"
                ? addMonths(localDate, 1)
                : addYears(localDate, 1);

    return fromZonedTime(next, APP_TIME_ZONE);
}

function dateAtRuleTime(base: Date, year: number, month: number, day: number) {
    const localBase = toZonedTime(base, APP_TIME_ZONE);
    const lastDay = lastDayOfMonth(new Date(year, month, 1)).getDate();
    const safeDay = day === 0 ? lastDay : Math.min(Math.max(day, 1), lastDay);
    const localDate = new Date(
        year,
        month,
        safeDay,
        localBase.getHours(),
        localBase.getMinutes(),
        localBase.getSeconds(),
        localBase.getMilliseconds(),
    );

    return fromZonedTime(localDate, APP_TIME_ZONE);
}

function getStandardCandidates(schedule: RecurrenceSchedule, until: Date) {
    if (schedule.frequency === "custom") {
        return [...schedule.calendarEntries]
            .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
            .map((entry, index) => ({
                sequence: index + 1,
                originalScheduledAt: entry.scheduledAt,
                scheduledAt: entry.scheduledAt,
                amountOverride: entry.amount,
            }));
    }

    const candidates: Candidate[] = [];

    if (schedule.frequency === "semimonthly") {
        const firstDay = schedule.semimonthlyFirstDay ?? 15;
        const secondDay = schedule.semimonthlySecondDay ?? 0;
        const firstMonth = toZonedTime(schedule.startsAt, APP_TIME_ZONE);
        let cursor = new Date(firstMonth.getFullYear(), firstMonth.getMonth(), 1);
        let sequence = 1;

        while (fromZonedTime(cursor, APP_TIME_ZONE) < until) {
            const dates = [
                dateAtRuleTime(schedule.startsAt, cursor.getFullYear(), cursor.getMonth(), firstDay),
                dateAtRuleTime(schedule.startsAt, cursor.getFullYear(), cursor.getMonth(), secondDay),
            ].sort((left, right) => left.getTime() - right.getTime());

            for (const date of dates) {
                if (date >= schedule.startsAt) {
                    candidates.push({
                        sequence,
                        originalScheduledAt: date,
                        scheduledAt: date,
                    });
                    sequence += 1;
                }
            }

            cursor = addMonths(cursor, 1);
            if (sequence > 2_000) throw new Error("La regla genera demasiadas ocurrencias.");
        }

        return candidates;
    }

    let scheduledAt = schedule.startsAt;
    let sequence = 1;
    while (scheduledAt < until) {
        candidates.push({
            sequence,
            originalScheduledAt: scheduledAt,
            scheduledAt,
        });
        scheduledAt = addFrequency(scheduledAt, schedule.frequency);
        sequence += 1;
        if (sequence > 2_000) throw new Error("La regla genera demasiadas ocurrencias.");
    }

    return candidates;
}

function getMonthKey(date: Date) {
    const zoned = toZonedTime(date, APP_TIME_ZONE);
    return `${zoned.getFullYear()}-${zoned.getMonth()}`;
}

function distributeInCents(total: number, count: number) {
    const totalCents = Math.round(total * 100);
    const base = Math.floor(totalCents / count);
    const remainder = totalCents - base * count;

    return Array.from({ length: count }, (_, index) => (
        (base + (index === count - 1 ? remainder : 0)) / 100
    ));
}

export function getOccurrencesInHorizon(schedule: RecurrenceSchedule, from: Date, until: Date) {
    const overrideByOriginalDate = new Map(
        schedule.dateOverrides.map((entry) => [entry.originalScheduledAt.getTime(), entry]),
    );
    const candidates = getStandardCandidates(schedule, until)
        .map((candidate) => {
            const override = overrideByOriginalDate.get(candidate.originalScheduledAt.getTime());
            return {
                ...candidate,
                scheduledAt: override?.scheduledAt ?? candidate.scheduledAt,
                amountOverride: override?.amount ?? candidate.amountOverride,
            };
        })
        .filter((candidate) => (
            candidate.scheduledAt >= schedule.startsAt
            && (!schedule.endsAt || candidate.scheduledAt <= schedule.endsAt)
        ));
    const amounts = new Map<number, number>();

    if (schedule.amountStrategy === "period_total") {
        const groups = new Map<string, Candidate[]>();
        for (const candidate of candidates) {
            const key = getMonthKey(candidate.scheduledAt);
            const group = groups.get(key) ?? [];
            group.push(candidate);
            groups.set(key, group);
        }

        for (const group of groups.values()) {
            const distributed = distributeInCents(schedule.periodTotal ?? schedule.amount, group.length);
            group.forEach((candidate, index) => amounts.set(candidate.sequence, distributed[index]));
        }
    } else {
        const groups = new Map<string, Candidate[]>();
        for (const candidate of candidates) {
            const key = getMonthKey(candidate.scheduledAt);
            const group = groups.get(key) ?? [];
            group.push(candidate);
            groups.set(key, group);
        }

        for (const group of groups.values()) {
            group.sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime());
            group.forEach((candidate, index) => {
                const fifthAmount = schedule.frequency === "weekly"
                    && index === 4
                    && schedule.fifthOccurrencePolicy === "custom_amount"
                    ? schedule.fifthOccurrenceAmount ?? schedule.amount
                    : schedule.amount;
                amounts.set(candidate.sequence, candidate.amountOverride ?? fifthAmount);
            });
        }
    }

    return candidates
        .filter((candidate) => candidate.scheduledAt >= from && candidate.scheduledAt < until)
        .map((candidate) => ({
            sequence: candidate.sequence,
            originalScheduledAt: candidate.originalScheduledAt,
            scheduledAt: candidate.scheduledAt,
            amount: amounts.get(candidate.sequence) ?? schedule.amount,
        }));
}
