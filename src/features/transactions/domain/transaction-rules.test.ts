import { describe, expect, it } from "vitest";
import {
    assertFundsApproved, getFundsImpact, InsufficientFundsError,
    requiresFundsApproval, type FundsAccount,
} from "./transaction-rules";

const debit = (currentBalance: number): FundsAccount => ({
    type: "debit",
    creditLimit: null,
    owedAmount: null,
    currentBalance,
});

const credit = (owedAmount: number, creditLimit = 1000): FundsAccount => ({
    type: "credit",
    creditLimit,
    owedAmount,
    currentBalance: owedAmount,
});

describe("reglas de fondos", () => {
    it("pide confirmación cuando un gasto deja una cuenta de débito en negativo", () => {
        expect(getFundsImpact(debit(0), -50)).toEqual({
            kind: "negative_balance",
            projectedShortfall: 50,
            newShortfall: 50,
        });
        expect(requiresFundsApproval(debit(0), -50)).toBe(true);
    });

    it("permite gastar exactamente el saldo disponible", () => {
        expect(requiresFundsApproval(debit(50), -50)).toBe(false);
    });

    it("no vuelve a pedir confirmación si el movimiento no empeora un saldo ya negativo", () => {
        expect(requiresFundsApproval(debit(-100), 30)).toBe(false);
        expect(requiresFundsApproval(debit(-100), -1)).toBe(true);
    });

    it("tolera errores de redondeo de punto flotante", () => {
        expect(requiresFundsApproval(debit(0.3), -0.1 - 0.2)).toBe(false);
    });

    it("mantiene la regla de límite para tarjetas de crédito", () => {
        expect(getFundsImpact(credit(900), 200)).toEqual({
            kind: "credit_limit",
            projectedShortfall: 100,
            newShortfall: 100,
        });
        expect(requiresFundsApproval(credit(900), 100)).toBe(false);
    });

    it("no valida saldo en préstamos", () => {
        expect(requiresFundsApproval({ ...debit(0), type: "loan" }, -50)).toBe(false);
    });

    it("lanza InsufficientFundsError salvo que el usuario confirme", () => {
        expect(() => assertFundsApproved(debit(0), -50, false))
            .toThrow(InsufficientFundsError);
        expect(() => assertFundsApproved(debit(0), -50, true)).not.toThrow();
    });
});
