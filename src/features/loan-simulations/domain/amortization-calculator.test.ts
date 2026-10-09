import { describe, expect, it } from "vitest";
import {
    annualRateWithVat, buildAmortizationSchedule, dueDateFor,
    nextBusinessDay, type LoanTerms,
} from "./amortization-calculator";

const kiaQuote: LoanTerms = {
    price: 372_600,
    bonus: 0,
    accessories: 0,
    downPaymentMode: "percent",
    downPaymentValue: 50,
    rateType: "interest",
    annualRatePercent: 7.9,
    rateIncludesVat: false,
    vatPercent: 16,
    termMonths: 12,
    firstDueDate: "2026-08-29",
    shiftToBusinessDay: true,
    openingFeeMode: "percent",
    openingFeeValue: 2.32,
    openingFeeFinanced: false,
    carInsuranceFirstYear: 17_523.96,
    carInsuranceFinanced: true,
    carInsuranceLaterAnnual: 0,
    lifeInsuranceMode: "fixed",
    lifeInsuranceValue: 798.32,
};

const expectedRows: Array<[string, number, number, number, number]> = [
    ["2026-08-31", 187_539.98, 14_883.95, 1_400.03, 1_555.86],
    ["2026-09-29", 171_131.70, 14_997.56, 1_410.72, 1_431.56],
    ["2026-10-29", 154_598.16, 15_112.05, 1_421.49, 1_306.30],
    ["2026-11-30", 137_938.42, 15_227.40, 1_432.34, 1_180.10],
    ["2026-12-29", 121_151.51, 15_343.64, 1_443.27, 1_052.93],
    ["2027-01-29", 104_236.46, 15_460.76, 1_454.29, 924.79],
    ["2027-03-01", 87_192.29, 15_578.78, 1_465.39, 795.67],
    ["2027-03-29", 70_018.02, 15_697.69, 1_476.58, 665.57],
    ["2027-04-29", 52_712.65, 15_817.52, 1_487.85, 534.47],
    ["2027-05-31", 35_275.18, 15_938.26, 1_499.21, 402.37],
    ["2027-06-29", 17_704.61, 16_059.92, 1_510.65, 269.27],
    ["2027-07-29", 0, 16_182.47, 1_522.14, 135.23],
];

describe("amortization calculator", () => {
    it("reproduces the bank quote to the cent", () => {
        const { rows, summary } = buildAmortizationSchedule(kiaQuote);

        expect(summary.annualRateWithVatPercent).toBe(9.16);
        expect(summary.downPayment).toBe(186_300);
        expect(summary.financedTotal).toBe(203_823.96);
        expect(summary.openingFee).toBe(4_728.72);
        expect(summary.initialPayment).toBe(191_028.72);
        expect(rows).toHaveLength(12);
        rows.forEach((row, index) => {
            const [paymentDate, closingBalance, principalVehicle, principalInsurance, interest] = expectedRows[index];
            expect(row).toMatchObject({
                sequence: index + 1,
                paymentDate,
                closingBalance,
                principalVehicle,
                principalInsurance,
                interest,
                lifeInsurance: 798.32,
                payment: 18_638.16,
            });
        });
    });

    it("accepts a rate that already includes VAT", () => {
        const withVat = buildAmortizationSchedule({ ...kiaQuote, annualRatePercent: 9.16, rateIncludesVat: true });
        expect(withVat.rows.map((row) => row.payment)).toEqual(buildAmortizationSchedule(kiaQuote).rows.map((row) => row.payment));
    });

    it("splits interest-free installments evenly and closes the balance on the last one", () => {
        const { rows, summary } = buildAmortizationSchedule({
            ...kiaQuote,
            price: 372_800,
            downPaymentValue: 30,
            rateType: "msi",
            termMonths: 36,
            firstDueDate: "2026-11-15",
            shiftToBusinessDay: false,
            openingFeeMode: "none",
            carInsuranceFirstYear: 0,
            lifeInsuranceMode: "none",
        });

        expect(summary.downPayment).toBe(111_840);
        expect(summary.financedTotal).toBe(260_960);
        expect(rows[0].payment).toBe(7_248.89);
        expect(rows.at(-1)?.closingBalance).toBe(0);
        expect(summary.totalInterest).toBe(0);
        expect(summary.totalPayments).toBe(260_960);
        expect(summary.effectiveAnnualCost).toBe(0);
    });

    it("charges life insurance on the outstanding balance when configured per thousand", () => {
        const { rows, summary } = buildAmortizationSchedule({
            ...kiaQuote,
            lifeInsuranceMode: "balance",
            lifeInsuranceValue: 3.9167,
        });

        expect(rows[0].lifeInsurance).toBe(798.32);
        expect(rows[11].lifeInsurance).toBe(69.34);
        expect(rows[11].lifeInsurance).toBeLessThan(rows[0].lifeInsurance);
        expect(summary.totalLifeInsurance).toBeLessThan(798.32 * 12);
    });

    it("adds a financed opening fee to the vehicle principal instead of the initial payment", () => {
        const { summary } = buildAmortizationSchedule({ ...kiaQuote, openingFeeFinanced: true });
        expect(summary.initialPayment).toBe(186_300);
        expect(summary.financedTotal).toBe(203_823.96 + 4_728.72);
    });

    it("charges cash car insurance upfront and prorates later years after month 12", () => {
        const { rows, summary } = buildAmortizationSchedule({
            ...kiaQuote,
            termMonths: 24,
            carInsuranceFinanced: false,
            carInsuranceLaterAnnual: 12_000,
        });

        expect(summary.financedInsurance).toBe(0);
        expect(summary.initialPayment).toBe(186_300 + 17_523.96 + summary.openingFee);
        expect(rows[11].carInsurance).toBe(0);
        expect(rows[12].carInsurance).toBe(1_000);
    });

    it("applies the bonus as a discount before the down payment", () => {
        const { summary } = buildAmortizationSchedule({ ...kiaQuote, bonus: 40_000, carInsuranceFirstYear: 0 });
        expect(summary.netPrice).toBe(332_600);
        expect(summary.downPayment).toBe(166_300);
    });

    it("reports a higher effective annual cost than the nominal rate when there are fees", () => {
        const { summary } = buildAmortizationSchedule(kiaQuote);
        expect(summary.effectiveAnnualCost).toBeGreaterThan(0.0916);
    });
});

describe("loan dates", () => {
    it("moves days missing in short months to the first of the next month", () => {
        expect(dueDateFor("2026-08-29", 6)).toBe("2027-03-01");
        expect(dueDateFor("2026-01-31", 1)).toBe("2026-03-01");
        expect(dueDateFor("2026-01-31", 2)).toBe("2026-03-31");
    });

    it("shifts weekends to the next Monday", () => {
        expect(nextBusinessDay("2026-08-29")).toBe("2026-08-31");
        expect(nextBusinessDay("2026-11-29")).toBe("2026-11-30");
        expect(nextBusinessDay("2026-09-29")).toBe("2026-09-29");
    });

    it("rounds the VAT-inclusive rate to two decimals", () => {
        expect(annualRateWithVat({ rateType: "interest", annualRatePercent: 7.9, rateIncludesVat: false, vatPercent: 16 })).toBe(9.16);
        expect(annualRateWithVat({ rateType: "msi", annualRatePercent: 7.9, rateIncludesVat: false, vatPercent: 16 })).toBe(0);
    });
});
