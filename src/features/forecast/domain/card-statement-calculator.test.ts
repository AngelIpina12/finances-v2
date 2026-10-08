import { describe, expect, it } from "vitest";
import { calculateCardStatement } from "./card-statement-calculator";
import { buildForecast, type ForecastAccount } from "./forecast-calculator";

const now = new Date("2026-10-07T18:00:00.000Z");

function statement() {
    return calculateCardStatement({
        cardId: "oro",
        billingDate: 24,
        paymentTermDays: 20,
        now,
        transactions: [
            { id: "super", name: "Súper", accountId: "oro", type: "expense", financingPlanId: null, amount: 1200, date: new Date("2026-09-10T18:00:00.000Z") },
            { id: "devolucion", name: "Devolución", accountId: "oro", type: "income", financingPlanId: null, amount: 200, date: new Date("2026-09-12T18:00:00.000Z") },
            { id: "pago", name: "Pago desde Nu", accountId: "oro", type: "transfer", transferDirection: "in", financingPlanId: null, amount: 300, date: new Date("2026-10-01T18:00:00.000Z") },
            { id: "cine", name: "Cine", accountId: "oro", type: "expense", financingPlanId: null, amount: 500, date: new Date("2026-09-30T18:00:00.000Z") },
        ],
        installmentOccurrences: [
            { id: "msi", name: "Laptop 3/12", accountId: "oro", source: "financing_installment", status: "scheduled", amount: 800, scheduledAt: new Date("2026-10-10T18:00:00.000Z") },
        ],
    });
}

describe("calculateCardStatement", () => {
    it("devuelve los conceptos que forman el estado de cuenta junto con su total", () => {
        const { calculatedStatementBalance, items } = statement();

        expect(calculatedStatementBalance).toBe(1500);
        expect(items.map((item) => [item.kind, item.name, item.amount])).toEqual([
            ["purchase", "Súper", 1200],
            ["credit", "Devolución", 200],
            ["installment", "Laptop 3/12", 800],
            ["payment", "Pago desde Nu", 300],
        ]);
    });

    it("lleva el detalle al pago de estado de cuenta de la previsión", () => {
        const { calculatedStatementBalance, items } = statement();
        const base = {
            currency: "MXN" as const, creditLimit: null, statementBalance: null,
            minimumPayment: null, includeInLiquidity: true,
        };
        const accounts: ForecastAccount[] = [
            { ...base, id: "nu", name: "Nu Débito", type: "debit", currentBalance: 5000, billingDate: null },
            {
                ...base, id: "oro", name: "BBVA Oro", type: "credit", currentBalance: 2000, billingDate: 24,
                creditLimit: 50000, includeInLiquidity: false, calculatedStatementBalance, statementItems: items,
            },
        ];
        const forecast = buildForecast({
            accounts,
            events: [],
            settings: [{
                creditAccountId: "oro", sourceAccountId: "nu", strategy: "full_statement",
                fixedAmount: null, paymentTermDays: 20, includeInForecast: true,
            }],
            now,
            days: 30,
        });
        const payment = forecast.events.find((event) => event.id.startsWith("card-statement:"));

        expect(payment?.amount).toBe(1500);
        expect(payment?.cardPaymentBreakdown?.statementItems).toHaveLength(4);
    });
});
