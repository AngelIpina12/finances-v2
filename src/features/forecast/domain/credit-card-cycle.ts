import {
    addDays, addMonths, lastDayOfMonth
} from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/src/shared/constants/date-time";

function dateAtLocalMidnight(year: number, month: number, day: number) {
    const lastDay = lastDayOfMonth(new Date(year, month, 1)).getDate();
    return fromZonedTime(new Date(year, month, Math.min(day, lastDay)), APP_TIME_ZONE);
}

function compareLocalDates(left: Date, right: Date) {
    const leftLocal = toZonedTime(left, APP_TIME_ZONE);
    const rightLocal = toZonedTime(right, APP_TIME_ZONE);
    return new Date(
        leftLocal.getFullYear(), leftLocal.getMonth(), leftLocal.getDate(),
    ).getTime() - new Date(
        rightLocal.getFullYear(), rightLocal.getMonth(), rightLocal.getDate(),
    ).getTime();
}

export function isAppCalendarDateBefore(left: Date, right: Date) {
    return compareLocalDates(left, right) < 0;
}

export function getCycleCloseForCharge(chargedAt: Date, billingDay: number) {
    const localCharge = toZonedTime(chargedAt, APP_TIME_ZONE);
    const currentMonthClose = dateAtLocalMidnight(
        localCharge.getFullYear(),
        localCharge.getMonth(),
        billingDay,
    );

    if (compareLocalDates(chargedAt, currentMonthClose) <= 0) return currentMonthClose;

    const nextMonth = addMonths(new Date(localCharge.getFullYear(), localCharge.getMonth(), 1), 1);
    return dateAtLocalMidnight(nextMonth.getFullYear(), nextMonth.getMonth(), billingDay);
}

export function getLatestCycleClose(now: Date, billingDay: number) {
    const localNow = toZonedTime(now, APP_TIME_ZONE);
    const currentMonthClose = dateAtLocalMidnight(
        localNow.getFullYear(),
        localNow.getMonth(),
        billingDay,
    );

    if (compareLocalDates(currentMonthClose, now) <= 0) return currentMonthClose;

    const previousMonth = addMonths(new Date(localNow.getFullYear(), localNow.getMonth(), 1), -1);
    return dateAtLocalMidnight(previousMonth.getFullYear(), previousMonth.getMonth(), billingDay);
}

export function getPaymentDueAt(closesAt: Date, paymentTermDays: number) {
    const localClose = toZonedTime(closesAt, APP_TIME_ZONE);
    const dueLocal = addDays(
        new Date(localClose.getFullYear(), localClose.getMonth(), localClose.getDate()),
        paymentTermDays,
    );
    return fromZonedTime(dueLocal, APP_TIME_ZONE);
}

export function getNextPaymentDueAt(now: Date, billingDay: number, paymentTermDays: number) {
    const latestClose = getLatestCycleClose(now, billingDay);
    const latestDueAt = getPaymentDueAt(latestClose, paymentTermDays);
    if (latestDueAt >= now) return latestDueAt;

    const nextCloseLocal = addMonths(toZonedTime(latestClose, APP_TIME_ZONE), 1);
    const nextClose = dateAtLocalMidnight(
        nextCloseLocal.getFullYear(),
        nextCloseLocal.getMonth(),
        billingDay,
    );
    return getPaymentDueAt(nextClose, paymentTermDays);
}
