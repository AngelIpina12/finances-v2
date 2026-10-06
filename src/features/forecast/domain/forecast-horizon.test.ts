import { describe, expect, it } from "vitest";
import {
    enforceGranularity, forecastRangeDays, formatRangePreset, suggestGranularity,
} from "./forecast-horizon";

describe("forecast horizon", () => {
    it("cuenta los días naturales del rango", () => {
        expect(forecastRangeDays("2026-10-05", "2027-10-05")).toBe(365);
        expect(forecastRangeDays("2026-10-05", "2026-11-04")).toBe(30);
    });

    it("sólo permite agrupar por día en rangos cortos", () => {
        expect(enforceGranularity("day", 60)).toBe("day");
        expect(enforceGranularity("day", 120)).toBe("week");
        expect(enforceGranularity("week", 365)).toBe("week");
    });

    it("sugiere agrupar por mes en rangos largos", () => {
        expect(suggestGranularity("week", 120)).toBe("week");
        expect(suggestGranularity("week", 365)).toBe("month");
        expect(suggestGranularity("day", 365)).toBe("month");
        expect(suggestGranularity("month", 30)).toBe("month");
    });

    it("nombra los presets cortos en días y los largos en meses", () => {
        expect([30, 90, 180, 365].map(formatRangePreset)).toEqual(["30d", "90d", "6m", "12m"]);
    });
});
