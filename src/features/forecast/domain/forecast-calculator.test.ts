import {
    describe, expect, it
} from "vitest";
import { buildForecast } from "./forecast-calculator";

const now = new Date("2026-09-05T12:00:00.000Z");

describe("buildForecast", () => {
    it("proyecta el saldo y alerta cuando un gasto deja una cuenta sin fondos", () => {
        const result = buildForecast({
            now,
            days: 30,
            accounts: [{
                id: "cash", name: "Efectivo", type: "cash", currency: "MXN",
                currentBalance: 500, creditLimit: null,
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
                currentBalance: 1000, creditLimit: null,
            }],
            events: [{
                id: "installment", accountId: null, source: "financing", name: "Cuota",
                amount: 500, currency: "MXN", scheduledAt: new Date("2026-09-06T12:00:00.000Z"),
                transactionType: "expense", affectsBalance: false,
            }],
        });

        expect(result.accounts[0]?.projectedBalance).toBe(1000);
        expect(result.events[0]?.balanceAfter).toBeNull();
    });

    it("proyecta el pago de la cuota en la cuenta elegida y reduce la deuda de la tarjeta", () => {
        const result = buildForecast({
            now,
            days: 30,
            accounts: [
                { id: "debit", name: "Débito", type: "debit", currency: "MXN", currentBalance: 1000, creditLimit: null },
                { id: "credit", name: "Tarjeta", type: "credit", currency: "MXN", currentBalance: 2000, creditLimit: 5000 },
            ],
            events: [{
                id: "installment", accountId: "debit", settlesAccountId: "credit", source: "financing", name: "Cuota",
                amount: 500, currency: "MXN", scheduledAt: new Date("2026-09-06T12:00:00.000Z"),
                transactionType: "expense", affectsBalance: true,
            }],
        });

        expect(result.accounts).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: "debit", projectedBalance: 500 }),
            expect.objectContaining({ id: "credit", projectedBalance: 1500 }),
        ]));
    });
});
