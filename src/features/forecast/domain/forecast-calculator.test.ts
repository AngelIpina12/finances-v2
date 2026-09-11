import {
    describe, expect, it
} from "vitest";
import { buildCreditDebtActivity, buildForecast } from "./forecast-calculator";

const now = new Date("2026-09-05T12:00:00.000Z");

describe("buildForecast", () => {
    it("proyecta el saldo y alerta cuando un gasto deja una cuenta sin fondos", () => {
        const result = buildForecast({
            now,
            days: 30,
            accounts: [{
                id: "cash", name: "Efectivo", type: "cash", currency: "MXN",
                currentBalance: 500, creditLimit: null, billingDate: null,
                statementBalance: null, minimumPayment: null, includeInLiquidity: true,
            }],
            events: [{
                id: "rent", accountId: "cash", source: "scheduled", name: "Renta",
                amount: 700, currency: "MXN", scheduledAt: new Date("2026-09-06T12:00:00.000Z"),
                transactionType: "expense", affectsBalance: true,
            }],
        });

        expect(result.accounts[0]?.projectedBalance).toBe(-200);
        expect(result.events[0]?.balanceAfter).toBe(-200);
        expect(result.alerts).toEqual([expect.objectContaining({
            accountId: "cash", kind: "insufficient_funds", amount: 200,
        })]);
    });

    it("no descuenta una cuota de financiamiento hasta conocer su cuenta de pago", () => {
        const result = buildForecast({
            now,
            days: 30,
            accounts: [{
                id: "debit", name: "Débito", type: "debit", currency: "MXN",
                currentBalance: 1000, creditLimit: null, billingDate: null,
                statementBalance: null, minimumPayment: null, includeInLiquidity: true,
            }],
            events: [{
                id: "installment", accountId: null, source: "financing", name: "Cuota",
                amount: 500, currency: "MXN", scheduledAt: new Date("2026-09-06T12:00:00.000Z"),
                transactionType: "expense", affectsBalance: false,
            }],
        });

        expect(result.accounts[0]?.projectedBalance).toBe(1000);
        expect(result.events).toHaveLength(0);
    });

    it("proyecta el pago de la cuota en la cuenta elegida y reduce la deuda de la tarjeta", () => {
        const result = buildForecast({
            now,
            days: 30,
            accounts: [
                { id: "debit", name: "Débito", type: "debit", currency: "MXN", currentBalance: 1000, creditLimit: null, billingDate: null, statementBalance: null, minimumPayment: null, includeInLiquidity: true },
                { id: "credit", name: "Tarjeta", type: "credit", currency: "MXN", currentBalance: 2000, creditLimit: 5000, billingDate: null, statementBalance: null, minimumPayment: null, includeInLiquidity: false },
            ],
            events: [{
                id: "installment", accountId: "debit", settlesAccountId: "credit", source: "financing", name: "Cuota",
                amount: 500, currency: "MXN", scheduledAt: new Date("2026-09-06T12:00:00.000Z"),
                transactionType: "expense", affectsBalance: true,
            }],
        });

        expect(result.accounts).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: "debit", projectedBalance: 1000 }),
            expect.objectContaining({ id: "credit", projectedBalance: 2000 }),
        ]));
        expect(result.events).toHaveLength(0);
    });

    it("convierte cargos previstos de una tarjeta en un pago líquido después del corte", () => {
        const result = buildForecast({
            now: new Date("2026-09-10T12:00:00.000Z"),
            days: 60,
            accounts: [
                { id: "debit", name: "Nómina", type: "debit", currency: "MXN", currentBalance: 5000, creditLimit: null, billingDate: null, statementBalance: null, minimumPayment: null, includeInLiquidity: true },
                { id: "credit", name: "Platinum", type: "credit", currency: "MXN", currentBalance: 1000, creditLimit: 10000, billingDate: 24, statementBalance: null, minimumPayment: null, includeInLiquidity: false },
            ],
            settings: [{
                creditAccountId: "credit",
                sourceAccountId: "debit",
                strategy: "full_statement",
                fixedAmount: null,
                paymentTermDays: 20,
                includeInForecast: true,
            }],
            events: [{
                id: "groceries", accountId: "credit", source: "recurring", name: "Mandado",
                amount: 3200, currency: "MXN", scheduledAt: new Date("2026-09-20T18:00:00.000Z"),
                transactionType: "expense", affectsBalance: true,
            }],
        });

        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: "card_payment", scheduledAt: new Date("2026-10-14T06:00:00.000Z"), amount: 3200 }),
        ]));
        expect(result.accounts).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: "debit", projectedBalance: 1800 }),
            expect.objectContaining({ id: "credit", projectedBalance: 1000 }),
        ]));
    });

    it("separa cargos y pagos al agrupar la actividad de una tarjeta", () => {
        const result = buildForecast({
            now,
            days: 30,
            accounts: [
                { id: "debit", name: "Débito", type: "debit", currency: "MXN", currentBalance: 5000, creditLimit: null, billingDate: null, statementBalance: null, minimumPayment: null, includeInLiquidity: true },
                { id: "credit", name: "Tarjeta", type: "credit", currency: "MXN", currentBalance: 1000, creditLimit: 10000, billingDate: null, statementBalance: null, minimumPayment: null, includeInLiquidity: false },
            ],
            events: [
                {
                    id: "charge", accountId: "credit", source: "scheduled", name: "Compra",
                    amount: 800, currency: "MXN", scheduledAt: new Date("2026-09-07T12:00:00.000Z"),
                    transactionType: "expense", affectsBalance: true,
                },
                {
                    id: "payment", accountId: "debit", settlesAccountId: "credit", source: "card_payment", name: "Pago",
                    amount: 600, currency: "MXN", scheduledAt: new Date("2026-09-08T12:00:00.000Z"),
                    transactionType: "expense", affectsBalance: true,
                },
            ],
        });

        expect(buildCreditDebtActivity(result.events, "credit", "week")).toEqual([{
            label: "Semana del 7 sep",
            charges: 800,
            payments: 600,
            netDebtChange: 200,
        }]);
    });

    it("muestra un compromiso manual futuro sin modificar la liquidez", () => {
        const result = buildForecast({
            now: new Date("2026-09-10T12:00:00.000Z"),
            days: 60,
            accounts: [
                { id: "debit", name: "Débito", type: "debit", currency: "MXN", currentBalance: 5000, creditLimit: null, billingDate: null, statementBalance: null, minimumPayment: null, includeInLiquidity: true },
                { id: "credit", name: "Tarjeta", type: "credit", currency: "MXN", currentBalance: 1000, creditLimit: 10000, billingDate: 24, statementBalance: null, minimumPayment: null, includeInLiquidity: false },
            ],
            settings: [{
                creditAccountId: "credit",
                sourceAccountId: "debit",
                strategy: "manual",
                fixedAmount: null,
                paymentTermDays: 20,
                includeInForecast: true,
            }],
            events: [{
                id: "charge", accountId: "credit", source: "scheduled", name: "Compra",
                amount: 3200, currency: "MXN", scheduledAt: new Date("2026-09-20T18:00:00.000Z"),
                transactionType: "expense", affectsBalance: true,
            }],
        });

        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                source: "card_payment",
                amount: 3200,
                affectsBalance: false,
                balanceAfter: null,
            }),
        ]));
        expect(result.accounts).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: "debit", projectedBalance: 5000 }),
            expect.objectContaining({ id: "credit", projectedBalance: 4200 }),
        ]));
    });
});
