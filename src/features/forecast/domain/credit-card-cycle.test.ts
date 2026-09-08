import {
    describe, expect, it
} from "vitest";
import {
    getCycleCloseForCharge, getLatestCycleClose, getNextPaymentDueAt,
    getPaymentDueAt, isAppCalendarDateBefore,
} from "./credit-card-cycle";

describe("credit card cycle dates", () => {
    it("asigna cargos antes y después del corte al ciclo correcto", () => {
        expect(getCycleCloseForCharge(new Date("2026-09-24T18:00:00.000Z"), 24).toISOString())
            .toBe("2026-09-24T06:00:00.000Z");
        expect(getCycleCloseForCharge(new Date("2026-09-25T18:00:00.000Z"), 24).toISOString())
            .toBe("2026-10-24T06:00:00.000Z");
    });

    it("suma días naturales al corte sin mover fines de semana", () => {
        expect(getPaymentDueAt(new Date("2026-09-24T06:00:00.000Z"), 20).toISOString())
            .toBe("2026-10-14T06:00:00.000Z");
        expect(getPaymentDueAt(new Date("2026-10-24T06:00:00.000Z"), 20).toISOString())
            .toBe("2026-11-13T06:00:00.000Z");
    });

    it("calcula el siguiente vencimiento futuro si el del ciclo actual ya pasó", () => {
        expect(getNextPaymentDueAt(new Date("2026-09-30T18:00:00.000Z"), 24, 5).toISOString())
            .toBe("2026-10-29T06:00:00.000Z");
    });

    it("ajusta un corte 31 al último día de febrero", () => {
        expect(getLatestCycleClose(new Date("2027-02-28T18:00:00.000Z"), 31).toISOString())
            .toBe("2027-02-28T06:00:00.000Z");
    });

    it("respeta febrero bisiesto antes de sumar el plazo", () => {
        const closesAt = getCycleCloseForCharge(new Date("2028-02-20T18:00:00.000Z"), 31);

        expect(closesAt.toISOString()).toBe("2028-02-29T06:00:00.000Z");
        expect(getPaymentDueAt(closesAt, 20).toISOString()).toBe("2028-03-20T06:00:00.000Z");
    });

    it("calcula correctamente un ciclo que cruza de diciembre a enero", () => {
        const closesAt = getCycleCloseForCharge(new Date("2026-12-26T18:00:00.000Z"), 24);

        expect(closesAt.toISOString()).toBe("2027-01-24T06:00:00.000Z");
        expect(getPaymentDueAt(closesAt, 20).toISOString()).toBe("2027-02-13T06:00:00.000Z");
    });

    it("asigna al corte actual una compra cercana a medianoche local", () => {
        expect(getCycleCloseForCharge(new Date("2026-09-25T05:30:00.000Z"), 24).toISOString())
            .toBe("2026-09-24T06:00:00.000Z");
    });

    it("no considera vencida una fecha mientras siga siendo el mismo día local", () => {
        expect(isAppCalendarDateBefore(
            new Date("2026-09-13T06:00:00.000Z"),
            new Date("2026-09-13T22:00:00.000Z"),
        )).toBe(false);
        expect(isAppCalendarDateBefore(
            new Date("2026-09-13T06:00:00.000Z"),
            new Date("2026-09-14T06:00:00.000Z"),
        )).toBe(true);
    });
});
