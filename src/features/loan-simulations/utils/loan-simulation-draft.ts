import { addMonths } from "date-fns";
import { toAppDateInputValue } from "@/src/shared/utils/local-date-time";
import type { LoanSimulationItem } from "../queries/get-loan-simulations-data";
import type { LoanSimulationData } from "../schemas/loan-simulation.schema";

export function createLoanSimulationDraft(): LoanSimulationData {
    return {
        name: "",
        notes: "",
        price: 0,
        bonus: 0,
        accessories: 0,
        downPaymentMode: "percent",
        downPaymentValue: 30,
        rateType: "interest",
        annualRatePercent: 0,
        rateIncludesVat: false,
        vatPercent: 16,
        termMonths: 36,
        firstDueDate: toAppDateInputValue(addMonths(new Date(), 1)),
        shiftToBusinessDay: true,
        openingFeeMode: "none",
        openingFeeValue: 0,
        openingFeeFinanced: false,
        carInsuranceFirstYear: 0,
        carInsuranceFinanced: false,
        carInsuranceLaterAnnual: 0,
        lifeInsuranceMode: "none",
        lifeInsuranceValue: 0,
    };
}

export function toLoanSimulationDraft(simulation: LoanSimulationItem, copy = false): LoanSimulationData {
    return {
        ...createLoanSimulationDraft(),
        ...simulation.terms,
        name: copy ? `${simulation.name} (copia)` : simulation.name,
        notes: simulation.notes ?? "",
    };
}
