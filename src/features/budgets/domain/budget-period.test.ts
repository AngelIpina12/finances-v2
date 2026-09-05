import { describe, expect, it } from "vitest";
import { getBudgetPeriodRanges, getRolloverAmount } from "./budget-period";

describe("budget periods", () => {
    it("genera periodos mensuales consecutivos desde el inicio", () => {
        const ranges = getBudgetPeriodRanges({
            period: "monthly",
            startsAt: new Date("2026-01-15T12:00:00.000Z"),
            endsAt: null,
            isReusable: true,
        }, new Date("2026-03-20T12:00:00.000Z"));

        expect(ranges).toHaveLength(3);
        expect(ranges[1]?.start).toEqual(new Date("2026-02-15T12:00:00.000Z"));
    });

    it("no genera un periodo posterior cuando no es reutilizable", () => {
        expect(getBudgetPeriodRanges({
            period: "monthly",
            startsAt: new Date("2026-01-01T12:00:00.000Z"),
            endsAt: null,
            isReusable: false,
        }, new Date("2026-03-01T12:00:00.000Z"))).toHaveLength(1);
    });

    it("arrastra sólo el sobrante o sólo el déficit según la estrategia", () => {
        expect(getRolloverAmount("carry_remaining", 250)).toBe(250);
        expect(getRolloverAmount("carry_remaining", -250)).toBe(0);
        expect(getRolloverAmount("carry_deficit", 250)).toBe(0);
        expect(getRolloverAmount("carry_deficit", -250)).toBe(-250);
    });
});
