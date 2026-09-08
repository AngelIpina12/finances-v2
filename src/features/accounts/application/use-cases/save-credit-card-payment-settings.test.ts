import { describe, expect, it, vi } from "vitest";
import type {
    CreditCardPaymentSettingsRepository, CreditCardPaymentSettingsScope,
    PaymentSettingsAccount,
} from "../../domain/credit-card-payment-settings-repository";
import { SaveCreditCardPaymentSettingsUseCase } from "./save-credit-card-payment-settings";

const input = {
    creditAccountId: "credit",
    sourceAccountId: "debit",
    strategy: "full_statement" as const,
    paymentTermDays: 20,
    includeInForecast: true,
    billingDate: 24,
};

function createUseCase(foundAccounts: Record<string, PaymentSettingsAccount | undefined>) {
    const scope = {
        findAccount: vi.fn(async (_userId: string, accountId: string) => foundAccounts[accountId]),
        save: vi.fn().mockResolvedValue(undefined),
    } as unknown as CreditCardPaymentSettingsScope;
    const repository: CreditCardPaymentSettingsRepository = {
        withinTransaction: (work) => work(scope),
    };

    return { useCase: new SaveCreditCardPaymentSettingsUseCase(repository), scope };
}

const credit: PaymentSettingsAccount = {
    id: "credit", type: "credit", currency: "MXN", includeInLiquidity: false,
};
const debit: PaymentSettingsAccount = {
    id: "debit", type: "debit", currency: "MXN", includeInLiquidity: true,
};

describe("SaveCreditCardPaymentSettingsUseCase", () => {
    it("guarda cuando la tarjeta y la cuenta líquida pertenecen al usuario y usan la misma moneda", async () => {
        const { useCase, scope } = createUseCase({ credit, debit });

        await useCase.execute("user-1", input);

        expect(scope.save).toHaveBeenCalledWith("user-1", input);
    });

    it("rechaza una tarjeta que no pertenece al usuario", async () => {
        const { useCase, scope } = createUseCase({ debit });

        await expect(useCase.execute("user-1", input)).rejects.toThrow(
            "Selecciona una tarjeta de crédito válida.",
        );
        expect(scope.save).not.toHaveBeenCalled();
    });

    it("rechaza una cuenta de pago archivada o no líquida", async () => {
        const { useCase, scope } = createUseCase({
            credit,
            debit: { ...debit, includeInLiquidity: false },
        });

        await expect(useCase.execute("user-1", input)).rejects.toThrow(
            "La cuenta de pago debe ser una cuenta líquida activa.",
        );
        expect(scope.save).not.toHaveBeenCalled();
    });

    it("rechaza cuentas con monedas diferentes", async () => {
        const { useCase, scope } = createUseCase({
            credit,
            debit: { ...debit, currency: "USD" },
        });

        await expect(useCase.execute("user-1", input)).rejects.toThrow(
            "La cuenta de pago debe ser distinta y usar la misma moneda que la tarjeta.",
        );
        expect(scope.save).not.toHaveBeenCalled();
    });
});
