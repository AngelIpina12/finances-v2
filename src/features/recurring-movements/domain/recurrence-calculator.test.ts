import { describe, expect, it } from "vitest";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/src/shared/constants/date-time";
import {
    getOccurrencesInHorizon, type RecurrenceSchedule,
} from "./recurrence-calculator";

const zonedDate = (value: string) => fromZonedTime(value, APP_TIME_ZONE);
const localDateTime = (value: Date) => formatInTimeZone(
    value,
    APP_TIME_ZONE,
    "yyyy-MM-dd HH:mm",
);

function schedule(overrides: Partial<RecurrenceSchedule> = {}): RecurrenceSchedule {
    return {
        startsAt: zonedDate("2026-01-01T09:00:00"),
        endsAt: null,
        frequency: "monthly",
        amount: 100,
        amountStrategy: "fixed",
        periodTotal: null,
        fifthOccurrencePolicy: "keep_fixed",
        fifthOccurrenceAmount: null,
        semimonthlyFirstDay: null,
        semimonthlySecondDay: null,
        calendarEntries: [],
        dateOverrides: [],
        ...overrides,
    };
}

describe("getOccurrencesInHorizon", () => {
    it("conserva el día ancla después de ajustar meses cortos", () => {
        const rule = schedule({ startsAt: zonedDate("2024-01-31T09:00:00") });

        const result = getOccurrencesInHorizon(
            rule,
            zonedDate("2024-01-01T00:00:00"),
            zonedDate("2024-04-02T00:00:00"),
        );

        expect(result.map((item) => localDateTime(item.scheduledAt))).toEqual([
            "2024-01-31 09:00",
            "2024-02-29 09:00",
            "2024-03-31 09:00",
        ]);
    });

    it("recupera el 29 de febrero en el siguiente año bisiesto", () => {
        const rule = schedule({
            startsAt: zonedDate("2024-02-29T08:30:00"),
            frequency: "yearly",
        });

        const result = getOccurrencesInHorizon(
            rule,
            zonedDate("2024-01-01T00:00:00"),
            zonedDate("2028-03-01T00:00:00"),
        );

        expect(result.map((item) => localDateTime(item.scheduledAt))).toEqual([
            "2024-02-29 08:30",
            "2025-02-28 08:30",
            "2026-02-28 08:30",
            "2027-02-28 08:30",
            "2028-02-29 08:30",
        ]);
    });

    it.each([
        [29, ["2023-01-29 09:00", "2023-02-28 09:00", "2023-03-29 09:00"]],
        [30, ["2023-01-30 09:00", "2023-02-28 09:00", "2023-03-30 09:00"]],
        [31, ["2023-01-31 09:00", "2023-02-28 09:00", "2023-03-31 09:00"]],
    ])("ajusta el día %i sin perderlo como ancla", (day, expected) => {
        const rule = schedule({
            startsAt: zonedDate(`2023-01-${day}T09:00:00`),
        });

        const result = getOccurrencesInHorizon(
            rule,
            zonedDate("2023-01-01T00:00:00"),
            zonedDate("2023-04-01T00:00:00"),
        );

        expect(result.map((item) => localDateTime(item.scheduledAt))).toEqual(expected);
    });

    it.each([
        ["weekly" as const, ["2026-09-03 09:00", "2026-09-10 09:00", "2026-09-17 09:00"]],
        ["biweekly" as const, ["2026-09-03 09:00", "2026-09-17 09:00"]],
    ])("avanza correctamente una frecuencia %s", (frequency, expected) => {
        const rule = schedule({
            startsAt: zonedDate("2026-09-03T09:00:00"),
            frequency,
        });

        const result = getOccurrencesInHorizon(
            rule,
            rule.startsAt,
            zonedDate("2026-09-24T00:00:00"),
        );

        expect(result.map((item) => localDateTime(item.scheduledAt))).toEqual(expected);
    });

    it("calcula dos fechas mensuales y respeta el último día de febrero", () => {
        const rule = schedule({
            startsAt: zonedDate("2024-01-01T10:00:00"),
            frequency: "semimonthly",
            semimonthlyFirstDay: 15,
            semimonthlySecondDay: 0,
        });

        const result = getOccurrencesInHorizon(
            rule,
            zonedDate("2024-01-01T00:00:00"),
            zonedDate("2024-03-01T00:00:00"),
        );

        expect(result.map((item) => localDateTime(item.scheduledAt))).toEqual([
            "2024-01-15 10:00",
            "2024-01-31 10:00",
            "2024-02-15 10:00",
            "2024-02-29 10:00",
        ]);
    });

    it("distribuye el total mensual exacto y deja el residuo en la última fecha", () => {
        const rule = schedule({
            startsAt: zonedDate("2026-05-01T09:00:00"),
            frequency: "weekly",
            amountStrategy: "period_total",
            periodTotal: 100.01,
        });

        const result = getOccurrencesInHorizon(
            rule,
            rule.startsAt,
            zonedDate("2026-06-01T00:00:00"),
        );

        expect(result.map((item) => item.amount)).toEqual([20, 20, 20, 20, 20.01]);
        expect(result.reduce((total, item) => total + item.amount, 0)).toBeCloseTo(100.01);
    });

    it("distribuye exactamente un total en un mes de cuatro pagos", () => {
        const rule = schedule({
            startsAt: zonedDate("2026-04-03T09:00:00"),
            frequency: "weekly",
            amountStrategy: "period_total",
            periodTotal: 100.01,
        });

        const result = getOccurrencesInHorizon(
            rule,
            rule.startsAt,
            zonedDate("2026-05-01T00:00:00"),
        );

        expect(result.map((item) => item.amount)).toEqual([25, 25, 25, 25.01]);
    });

    it("aplica un monto especial únicamente a la quinta fecha semanal", () => {
        const rule = schedule({
            startsAt: zonedDate("2026-05-01T09:00:00"),
            frequency: "weekly",
            amount: 5000,
            amountStrategy: "custom_per_occurrence",
            fifthOccurrencePolicy: "custom_amount",
            fifthOccurrenceAmount: 2500,
        });

        const result = getOccurrencesInHorizon(
            rule,
            rule.startsAt,
            zonedDate("2026-06-01T00:00:00"),
        );

        expect(result.map((item) => item.amount)).toEqual([5000, 5000, 5000, 5000, 2500]);
    });

    it("mueve sólo la ocurrencia indicada mediante una excepción", () => {
        const originalDate = zonedDate("2024-02-29T09:00:00");
        const movedDate = zonedDate("2024-02-27T12:30:00");
        const rule = schedule({
            startsAt: zonedDate("2024-01-31T09:00:00"),
            dateOverrides: [{
                originalScheduledAt: originalDate,
                scheduledAt: movedDate,
                amount: 55,
            }],
        });

        const result = getOccurrencesInHorizon(
            rule,
            zonedDate("2024-01-01T00:00:00"),
            zonedDate("2024-04-02T00:00:00"),
        );

        expect(result.map((item) => ({
            original: localDateTime(item.originalScheduledAt),
            scheduled: localDateTime(item.scheduledAt),
            amount: item.amount,
        }))).toEqual([
            { original: "2024-01-31 09:00", scheduled: "2024-01-31 09:00", amount: 100 },
            { original: "2024-02-29 09:00", scheduled: "2024-02-27 12:30", amount: 55 },
            { original: "2024-03-31 09:00", scheduled: "2024-03-31 09:00", amount: 100 },
        ]);
    });

    it("ordena el calendario personalizado y conserva sus montos", () => {
        const rule = schedule({
            frequency: "custom",
            calendarEntries: [
                { scheduledAt: zonedDate("2026-03-20T09:00:00"), amount: 300 },
                { scheduledAt: zonedDate("2026-02-10T09:00:00"), amount: 200 },
            ],
        });

        const result = getOccurrencesInHorizon(
            rule,
            zonedDate("2026-01-01T00:00:00"),
            zonedDate("2026-04-01T00:00:00"),
        );

        expect(result.map((item) => [item.sequence, localDateTime(item.scheduledAt), item.amount])).toEqual([
            [1, "2026-02-10 09:00", 200],
            [2, "2026-03-20 09:00", 300],
        ]);
    });

    it("incluye la fecha final y no genera ocurrencias posteriores", () => {
        const endsAt = zonedDate("2026-03-01T09:00:00");
        const rule = schedule({
            startsAt: zonedDate("2026-01-01T09:00:00"),
            endsAt,
        });

        const result = getOccurrencesInHorizon(
            rule,
            rule.startsAt,
            zonedDate("2026-05-01T00:00:00"),
        );

        expect(result.map((item) => localDateTime(item.scheduledAt))).toEqual([
            "2026-01-01 09:00",
            "2026-02-01 09:00",
            "2026-03-01 09:00",
        ]);
    });
});
