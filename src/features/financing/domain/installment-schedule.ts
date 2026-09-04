import { lastDayOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/src/shared/constants/date-time";
import type { InstallmentDraft } from "./financing-repository";

function monthlyDate(startsAt: Date, offset: number) {
    const localStart = toZonedTime(startsAt, APP_TIME_ZONE);
    const month = new Date(localStart.getFullYear(), localStart.getMonth() + offset, 1);
    const lastDay = lastDayOfMonth(month).getDate();
    const localDate = new Date(
        month.getFullYear(),
        month.getMonth(),
        Math.min(localStart.getDate(), lastDay),
        localStart.getHours(),
        localStart.getMinutes(),
        localStart.getSeconds(),
        localStart.getMilliseconds(),
    );

    return fromZonedTime(localDate, APP_TIME_ZONE);
}

interface Props {
    startsAt: Date;
    regularInstallmentCount: number;
    regularInstallmentAmount: number;
    balloonAmount: number;
}

export function buildInstallmentSchedule(input: Props): InstallmentDraft[] {
    const regular = Array.from({ length: input.regularInstallmentCount }, (_, index) => ({
        sequence: index + 1,
        scheduledAt: monthlyDate(input.startsAt, index),
        amount: input.regularInstallmentAmount,
        isBalloon: false,
    }));

    if (input.balloonAmount <= 0) return regular;

    return [
        ...regular,
        {
            sequence: regular.length + 1,
            scheduledAt: monthlyDate(input.startsAt, regular.length),
            amount: input.balloonAmount,
            isBalloon: true,
        },
    ];
}
