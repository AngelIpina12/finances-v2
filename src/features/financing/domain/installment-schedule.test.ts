import { describe, expect, it } from "vitest";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/src/shared/constants/date-time";
import { buildInstallmentSchedule } from "./installment-schedule";

const localDate = (date: Date) => formatInTimeZone(date, APP_TIME_ZONE, "yyyy-MM-dd HH:mm");

describe("buildInstallmentSchedule", () => {
    it("conserva el día ancla después de febrero", () => {
        const installments = buildInstallmentSchedule({
            startsAt: fromZonedTime("2026-01-31T09:00:00", APP_TIME_ZONE),
            regularInstallmentCount: 3,
            regularInstallmentAmount: 100,
            balloonAmount: 0,
        });

        expect(installments.map((item) => localDate(item.scheduledAt))).toEqual([
            "2026-01-31 09:00",
            "2026-02-28 09:00",
            "2026-03-31 09:00",
        ]);
    });

    it("agrega el pago final en el mes posterior a las cuotas regulares", () => {
        const installments = buildInstallmentSchedule({
            startsAt: fromZonedTime("2026-05-15T12:00:00", APP_TIME_ZONE),
            regularInstallmentCount: 2,
            regularInstallmentAmount: 760,
            balloonAmount: 9800,
        });

        expect(installments).toMatchObject([
            { sequence: 1, amount: 760, isBalloon: false },
            { sequence: 2, amount: 760, isBalloon: false },
            { sequence: 3, amount: 9800, isBalloon: true },
        ]);
        expect(localDate(installments[2].scheduledAt)).toBe("2026-07-15 12:00");
    });
});
