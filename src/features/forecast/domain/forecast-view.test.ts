import { describe, expect, it } from "vitest";
import { resolveForecastViewRange } from "./forecast-view";

const addDays = (date: string, days: number) => {
    const next = new Date(`${date}T00:00:00.000Z`);
    next.setUTCDate(next.getUTCDate() + days);
    return next.toISOString().slice(0, 10);
};
const horizon = { minimumDate: "2026-10-02", maximumDate: "2027-03-31", addDays };

describe("resolveForecastViewRange", () => {
    it("recalcula un rango relativo desde hoy", () => {
        expect(resolveForecastViewRange({ rangePresetDays: 90, startsOn: null, endsOn: null }, horizon))
            .toEqual({ startsOn: "2026-10-02", endsOn: "2026-12-31", preset: 90 });
    });

    it("conserva las fechas fijas dentro del horizonte", () => {
        expect(resolveForecastViewRange({ rangePresetDays: null, startsOn: "2026-11-01", endsOn: "2026-12-15" }, horizon))
            .toEqual({ startsOn: "2026-11-01", endsOn: "2026-12-15", preset: null });
    });

    it("recorta las fechas fijas que ya pasaron o exceden el horizonte", () => {
        expect(resolveForecastViewRange({ rangePresetDays: null, startsOn: "2026-09-01", endsOn: "2027-06-01" }, horizon))
            .toEqual({ startsOn: "2026-10-02", endsOn: "2027-03-31", preset: null });
    });

    it("deja al menos un día cuando todo el rango ya pasó", () => {
        expect(resolveForecastViewRange({ rangePresetDays: null, startsOn: "2026-08-01", endsOn: "2026-09-01" }, horizon))
            .toEqual({ startsOn: "2026-10-02", endsOn: "2026-10-03", preset: null });
    });
});
