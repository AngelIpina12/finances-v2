import { addMonths, addWeeks, addYears } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/src/shared/constants/date-time";

export type RecurrenceFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

export type RecurrenceSchedule = {
    startsAt: Date;
    endsAt: Date | null;
    frequency: RecurrenceFrequency;
};

export type GeneratedScheduleItem = {
    sequence: number;
    scheduledAt: Date;
};

function addFrequency(date: Date, frequency: RecurrenceFrequency) {
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

export function getOccurrencesInHorizon(schedule: RecurrenceSchedule, from: Date, until: Date) {
    const occurrences: GeneratedScheduleItem[] = [];
    let scheduledAt = schedule.startsAt;
    let sequence = 1;

    while (scheduledAt < until) {
        if (schedule.endsAt && scheduledAt > schedule.endsAt) {
            break;
        }

        if (scheduledAt >= from) {
            occurrences.push({ sequence, scheduledAt });
        }

        scheduledAt = addFrequency(scheduledAt, schedule.frequency);
        sequence += 1;

        if (sequence > 2_000) {
            throw new Error("La regla genera demasiadas ocurrencias.");
        }
    }

    return occurrences;
}
