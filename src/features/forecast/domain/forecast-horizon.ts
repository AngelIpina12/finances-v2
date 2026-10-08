import { fromZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/src/shared/constants/date-time";
import type { ForecastGranularity } from "./forecast-calculator";

export const FORECAST_END_DATE = "2028-01-01";
export const FORECAST_RANGE_PRESETS = [30, 60, 90, 180, 365] as const;
export const DAILY_GRANULARITY_MAX_DAYS = 90;
export const WEEKLY_GRANULARITY_MAX_DAYS = 180;
export const RELIABLE_RANGE_DAYS = 180;

const DAY_MS = 24 * 60 * 60 * 1000;

export function getForecastHorizonEnd() {
    return fromZonedTime(`${FORECAST_END_DATE}T00:00:00`, APP_TIME_ZONE);
}

export function getForecastHorizonDays(now: Date) {
    return Math.max(1, Math.ceil((getForecastHorizonEnd().getTime() - now.getTime()) / DAY_MS));
}

export function forecastRangeDays(startsOn: string, endsOn: string) {
    return Math.round((Date.parse(`${endsOn}T00:00:00Z`) - Date.parse(`${startsOn}T00:00:00Z`)) / DAY_MS);
}

export function formatRangePreset(days: number) {
    return days >= 180 ? `${Math.round(days / 30.4)}m` : `${days}d`;
}

export function allowsDailyGranularity(rangeDays: number) {
    return rangeDays <= DAILY_GRANULARITY_MAX_DAYS;
}

export function enforceGranularity(granularity: ForecastGranularity, rangeDays: number): ForecastGranularity {
    return granularity === "day" && !allowsDailyGranularity(rangeDays) ? "week" : granularity;
}

export function suggestGranularity(granularity: ForecastGranularity, rangeDays: number): ForecastGranularity {
    if (rangeDays > WEEKLY_GRANULARITY_MAX_DAYS) return "month";
    return enforceGranularity(granularity, rangeDays);
}
