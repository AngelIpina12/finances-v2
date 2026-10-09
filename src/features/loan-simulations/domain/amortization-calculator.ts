export type LoanRateType = "interest" | "msi";
export type DownPaymentMode = "percent" | "amount";
export type OpeningFeeMode = "none" | "percent" | "amount";
export type LifeInsuranceMode = "none" | "fixed" | "balance";

export interface LoanTerms {
    price: number;
    bonus: number;
    accessories: number;
    downPaymentMode: DownPaymentMode;
    downPaymentValue: number;
    rateType: LoanRateType;
    annualRatePercent: number;
    rateIncludesVat: boolean;
    vatPercent: number;
    termMonths: number;
    firstDueDate: string;
    shiftToBusinessDay: boolean;
    openingFeeMode: OpeningFeeMode;
    openingFeeValue: number;
    openingFeeFinanced: boolean;
    carInsuranceFirstYear: number;
    carInsuranceFinanced: boolean;
    carInsuranceLaterAnnual: number;
    lifeInsuranceMode: LifeInsuranceMode;
    lifeInsuranceValue: number;
}

export interface AmortizationRow {
    sequence: number;
    dueDate: string;
    paymentDate: string;
    openingBalance: number;
    principalVehicle: number;
    principalInsurance: number;
    interest: number;
    lifeInsurance: number;
    carInsurance: number;
    payment: number;
    closingBalance: number;
}

export interface AmortizationSummary {
    netPrice: number;
    downPayment: number;
    openingFee: number;
    financedVehicle: number;
    financedInsurance: number;
    financedTotal: number;
    initialPayment: number;
    annualRateWithVatPercent: number;
    firstPayment: number;
    maxPayment: number;
    totalInterest: number;
    totalLifeInsurance: number;
    totalCarInsurance: number;
    totalPayments: number;
    totalPaid: number;
    financialCost: number;
    effectiveAnnualCost: number | null;
    lastPaymentDate: string | null;
}

export interface AmortizationResult {
    rows: AmortizationRow[];
    summary: AmortizationSummary;
}

const MS_PER_DAY = 86_400_000;

function toCents(value: number) {
    return Math.round((value + Number.EPSILON) * 100);
}

function fromCents(cents: number) {
    return cents / 100;
}

function formatDate(date: Date) {
    return date.toISOString().slice(0, 10);
}

export function dueDateFor(firstDueDate: string, offset: number) {
    const [year, month, day] = firstDueDate.split("-").map(Number);
    const daysInTarget = new Date(Date.UTC(year, month - 1 + offset + 1, 0)).getUTCDate();
    const date = day > daysInTarget
        ? new Date(Date.UTC(year, month - 1 + offset + 1, 1))
        : new Date(Date.UTC(year, month - 1 + offset, day));
    return formatDate(date);
}

export function nextBusinessDay(isoDate: string) {
    let date = new Date(`${isoDate}T00:00:00Z`);
    while (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
        date = new Date(date.getTime() + MS_PER_DAY);
    }
    return formatDate(date);
}

export function annualRateWithVat(terms: Pick<LoanTerms, "rateType" | "annualRatePercent" | "rateIncludesVat" | "vatPercent">) {
    if (terms.rateType === "msi") return 0;
    if (terms.rateIncludesVat) return terms.annualRatePercent;
    return Math.round(terms.annualRatePercent * (1 + terms.vatPercent / 100) * 100) / 100;
}

export function downPaymentAmount(terms: Pick<LoanTerms, "price" | "bonus" | "accessories" | "downPaymentMode" | "downPaymentValue">) {
    const netPriceCents = toCents(terms.price - terms.bonus + terms.accessories);
    return fromCents(terms.downPaymentMode === "percent"
        ? Math.round(netPriceCents * terms.downPaymentValue / 100)
        : toCents(terms.downPaymentValue));
}

interface SubLoan {
    balance: number;
    payment: number;
}

function createSubLoan(principalCents: number, monthlyRate: number, months: number): SubLoan {
    if (principalCents <= 0) return { balance: 0, payment: 0 };
    const payment = monthlyRate === 0
        ? principalCents / months
        : principalCents * monthlyRate / (1 - (1 + monthlyRate) ** -months);
    return { balance: principalCents, payment: Math.round(payment) };
}

function amortize(loan: SubLoan, monthlyRate: number, isLast: boolean) {
    if (loan.balance <= 0) return { principal: 0, interest: 0 };
    const interest = Math.round(loan.balance * monthlyRate);
    if (!isLast) {
        const principal = Math.min(loan.balance, loan.payment - interest);
        loan.balance -= principal;
        return { principal, interest };
    }
    const principal = loan.balance;
    loan.balance = 0;
    return {
        principal,
        interest: monthlyRate === 0 ? 0 : Math.max(interest, loan.payment - principal),
    };
}

function monthlyIrr(initialCents: number, outflowsCents: number[]) {
    if (initialCents <= 0 || !outflowsCents.length) return null;
    const npv = (rate: number) => outflowsCents.reduce(
        (total, flow, index) => total - flow / (1 + rate) ** (index + 1),
        initialCents,
    );
    let low = 0;
    let high = 1;
    if (npv(low) > 0) return null;
    if (npv(low) === 0) return 0;
    if (npv(high) < 0) return null;
    for (let iteration = 0; iteration < 200; iteration += 1) {
        const middle = (low + high) / 2;
        if (npv(middle) < 0) low = middle;
        else high = middle;
    }
    return (low + high) / 2;
}

export function buildAmortizationSchedule(terms: LoanTerms): AmortizationResult {
    const months = Math.max(1, Math.trunc(terms.termMonths));
    const netPriceCents = toCents(terms.price - terms.bonus + terms.accessories);
    const downPaymentCents = toCents(downPaymentAmount(terms));
    const insuranceCents = toCents(terms.carInsuranceFirstYear);
    const financedInsuranceCents = terms.carInsuranceFinanced ? insuranceCents : 0;
    const baseFinancedCents = Math.max(0, netPriceCents - downPaymentCents) + financedInsuranceCents;
    const openingFeeCents = terms.openingFeeMode === "percent"
        ? Math.round(baseFinancedCents * terms.openingFeeValue / 100)
        : terms.openingFeeMode === "amount" ? toCents(terms.openingFeeValue) : 0;
    const financedVehicleCents = Math.max(0, netPriceCents - downPaymentCents)
        + (terms.openingFeeFinanced ? openingFeeCents : 0);
    const financedTotalCents = financedVehicleCents + financedInsuranceCents;
    const initialPaymentCents = downPaymentCents
        + (terms.openingFeeFinanced ? 0 : openingFeeCents)
        + (terms.carInsuranceFinanced ? 0 : insuranceCents);

    const ratePercent = annualRateWithVat(terms);
    const monthlyRate = ratePercent / 100 / 12;
    const vehicle = createSubLoan(financedVehicleCents, monthlyRate, months);
    const insurance = createSubLoan(financedInsuranceCents, monthlyRate, months);
    const laterInsuranceMonthlyCents = Math.round(toCents(terms.carInsuranceLaterAnnual) / 12);

    const rows: AmortizationRow[] = [];
    const creditOutflows: number[] = [];
    let totals = { interest: 0, life: 0, car: 0, payments: 0 };

    for (let index = 0; index < months && financedTotalCents > 0; index += 1) {
        const isLast = index === months - 1;
        const openingBalance = vehicle.balance + insurance.balance;
        const vehicleStep = amortize(vehicle, monthlyRate, isLast);
        const insuranceStep = amortize(insurance, monthlyRate, isLast);
        const interest = vehicleStep.interest + insuranceStep.interest;
        const lifeInsurance = terms.lifeInsuranceMode === "fixed"
            ? toCents(terms.lifeInsuranceValue)
            : terms.lifeInsuranceMode === "balance"
                ? Math.round(openingBalance * terms.lifeInsuranceValue / 1000)
                : 0;
        const carInsurance = index >= 12 ? laterInsuranceMonthlyCents : 0;
        const creditPayment = vehicleStep.principal + insuranceStep.principal + interest + lifeInsurance;
        const payment = creditPayment + carInsurance;
        const dueDate = dueDateFor(terms.firstDueDate, index);

        rows.push({
            sequence: index + 1,
            dueDate,
            paymentDate: terms.shiftToBusinessDay ? nextBusinessDay(dueDate) : dueDate,
            openingBalance: fromCents(openingBalance),
            principalVehicle: fromCents(vehicleStep.principal),
            principalInsurance: fromCents(insuranceStep.principal),
            interest: fromCents(interest),
            lifeInsurance: fromCents(lifeInsurance),
            carInsurance: fromCents(carInsurance),
            payment: fromCents(payment),
            closingBalance: fromCents(vehicle.balance + insurance.balance),
        });
        creditOutflows.push(creditPayment);
        totals = {
            interest: totals.interest + interest,
            life: totals.life + lifeInsurance,
            car: totals.car + carInsurance,
            payments: totals.payments + payment,
        };
    }

    const irr = monthlyIrr(financedTotalCents - openingFeeCents, creditOutflows);

    return {
        rows,
        summary: {
            netPrice: fromCents(netPriceCents),
            downPayment: fromCents(downPaymentCents),
            openingFee: fromCents(openingFeeCents),
            financedVehicle: fromCents(financedVehicleCents),
            financedInsurance: fromCents(financedInsuranceCents),
            financedTotal: fromCents(financedTotalCents),
            initialPayment: fromCents(initialPaymentCents),
            annualRateWithVatPercent: ratePercent,
            firstPayment: rows[0]?.payment ?? 0,
            maxPayment: rows.reduce((max, row) => Math.max(max, row.payment), 0),
            totalInterest: fromCents(totals.interest),
            totalLifeInsurance: fromCents(totals.life),
            totalCarInsurance: fromCents(totals.car),
            totalPayments: fromCents(totals.payments),
            totalPaid: fromCents(initialPaymentCents + totals.payments),
            financialCost: fromCents(totals.interest + openingFeeCents + totals.life),
            effectiveAnnualCost: irr === null ? null : (1 + irr) ** 12 - 1,
            lastPaymentDate: rows.at(-1)?.paymentDate ?? null,
        },
    };
}
