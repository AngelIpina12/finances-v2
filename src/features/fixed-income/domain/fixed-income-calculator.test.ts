import { describe, expect, it } from "vitest";
import { calculateAccruedInterest, calculateDailyInterest, calculateNetInterest, calculateProjectedDailyNetInterest } from "./fixed-income-calculator";

describe("fixed income calculator", () => {
    it("uses the selected annual day-count convention", () => {
        expect(calculateDailyInterest(10_000, 0.12, "actual_360")).toBe(3.33);
        expect(calculateDailyInterest(10_000, 0.12, "actual_365")).toBe(3.29);
    });

    it("calculates simple and compound interest across a leap-year February", () => {
        const base = { principal: 10_000, annualRate: 0.365, startsAt: new Date("2024-02-28T12:00:00Z"), asOf: new Date("2024-03-01T12:00:00Z"), dayCountConvention: "actual_365" as const };
        expect(calculateAccruedInterest({ ...base, calculationMethod: "simple" })).toEqual({ days: 2, gross: 20 });
        expect(calculateAccruedInterest({ ...base, calculationMethod: "compound" }).gross).toBe(20.01);
    });

    it("separates withholding from gross interest", () => {
        expect(calculateNetInterest(100, 0.1)).toEqual({ tax: 10, net: 90 });
    });

    it("projects each daily yield with the balance accumulated on the prior day", () => {
        expect(calculateProjectedDailyNetInterest({
            principal: 1_000,
            annualRate: 1,
            convention: "actual_360",
            days: 2,
        })).toEqual([2.78, 2.79]);
    });
});
