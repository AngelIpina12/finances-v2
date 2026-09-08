import { fromZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/src/shared/constants/date-time";

export function fromForecastDateInput(value: string) {
    const date = fromZonedTime(`${value}T00:00:00`, APP_TIME_ZONE);
    return Number.isNaN(date.getTime()) ? null : date;
}

export function isInsideForecastRange(date: Date, startsAt: Date, endsAt: Date) {
    return date >= startsAt && date < endsAt;
}
