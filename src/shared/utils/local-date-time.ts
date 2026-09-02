import {
    addDays, addMonths, startOfMonth,
    subMilliseconds, subMonths,
} from "date-fns";
import {
    formatInTimeZone, fromZonedTime, toZonedTime,
} from "date-fns-tz";
import {
    APP_LOCALE, APP_TIME_ZONE,
} from "@/src/shared/constants/date-time";

export type AppMonthRange = {
    start: Date;
    end: Date;
    previousStart: Date;
};

export function toAppDateTimeInputValue(date = new Date()) {
    return formatInTimeZone(
        date,
        APP_TIME_ZONE,
        "yyyy-MM-dd'T'HH:mm",
    );
}

export function fromAppDateTimeInputValue(value: string) {
    if (!value) return undefined;

    const date = fromZonedTime(value, APP_TIME_ZONE);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

export function toAppDateInputValue(date = new Date()) {
    return formatInTimeZone(date, APP_TIME_ZONE, "yyyy-MM-dd");
}

export function formatAppDate(
    value: Date | string | number,
    options: Intl.DateTimeFormatOptions,
    locale = APP_LOCALE,
) {
    return new Intl.DateTimeFormat(locale, {
        ...options,
        timeZone: APP_TIME_ZONE,
    }).format(new Date(value));
}

export function formatAppDateTime(
    value: Date | string | number,
    options: Intl.DateTimeFormatOptions = {},
    locale = APP_LOCALE,
) {
    return formatAppDate(value, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        ...options,
    }, locale);
}

export function getAppHour(date = new Date()) {
    return Number(formatInTimeZone(date, APP_TIME_ZONE, "H"));
}

export function getAppMonthRange(now = new Date()): AppMonthRange {
    const zonedNow = toZonedTime(now, APP_TIME_ZONE);
    const zonedStart = startOfMonth(zonedNow);

    return {
        start: fromZonedTime(zonedStart, APP_TIME_ZONE),
        end: fromZonedTime(addMonths(zonedStart, 1), APP_TIME_ZONE),
        previousStart: fromZonedTime(subMonths(zonedStart, 1), APP_TIME_ZONE),
    };
}

export function getAppMonthEnd(now: Date, monthOffset: number) {
    const zonedNow = toZonedTime(now, APP_TIME_ZONE);
    const zonedNextMonthStart = startOfMonth(
        addMonths(zonedNow, monthOffset + 1),
    );

    return subMilliseconds(
        fromZonedTime(zonedNextMonthStart, APP_TIME_ZONE),
        1,
    );
}

export function addAppCalendarDays(date: Date, amount: number) {
    const zonedDate = toZonedTime(date, APP_TIME_ZONE);

    return fromZonedTime(addDays(zonedDate, amount), APP_TIME_ZONE);
}
