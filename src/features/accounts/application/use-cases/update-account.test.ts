import {
    describe, expect, it,
    vi
} from "vitest";
import type { AccountRepository } from "../../domain/account-repository";
import { UpdateAccountUseCase } from "./update-account";

describe("UpdateAccountUseCase", () => {
    it("actualiza únicamente el saldo actual indicado al editar una cuenta", async () => {
        const repository = {
            update: vi.fn().mockResolvedValue(true),
        } as unknown as AccountRepository;
        const useCase = new UpdateAccountUseCase(repository);

        await useCase.execute("user-1", "account-1", {
            name: "Cuenta diaria",
            type: "debit",
            currency: "MXN",
            institution: "Banco",
            openingBalance: 0,
            currentBalance: 700,
            color: "#2563eb",
            includeInNetWorth: true,
            includeInLiquidity: true,
        });

        expect(repository.update).toHaveBeenCalledWith("user-1", "account-1", {
            name: "Cuenta diaria",
            type: "debit",
            currency: "MXN",
            institution: "Banco",
            currentBalance: "700",
            color: "#2563eb",
            lastFourDigits: null,
            includeInNetWorth: true,
            includeInLiquidity: true,
            creditLimit: null,
            billingDate: null,
            dueDate: null,
        });
    });
});
