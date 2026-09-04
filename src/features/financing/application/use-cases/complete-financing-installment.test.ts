import { describe, expect, it, vi } from "vitest";
import type { FinancingRepository, FinancingScope } from "../../domain/financing-repository";
import { CompleteFinancingInstallmentUseCase } from "./complete-financing-installment";

describe("CompleteFinancingInstallmentUseCase", () => {
    it("registra una transferencia y reduce la deuda una sola vez", async () => {
        const scope = {
            findInstallmentForUpdate: vi.fn().mockResolvedValue({
                id: "installment-1",
                financingPlanId: "plan-1",
                sequence: 1,
                scheduledAt: new Date(),
                amount: 760,
                isBalloon: false,
                paidAt: null,
                scheduledOccurrenceId: "occurrence-1",
                creditAccountId: "credit-1",
                currency: "MXN",
                planName: "Laptop",
                planStatus: "active",
            }),
            findAccount: vi.fn()
                .mockResolvedValueOnce({ id: "cash-1", type: "debit", currency: "MXN", creditLimit: null, owedAmount: null })
                .mockResolvedValueOnce({ id: "credit-1", type: "credit", currency: "MXN", creditLimit: 10000, owedAmount: 5000 }),
            insertPaymentTransfer: vi.fn().mockResolvedValue(undefined),
            applyBalanceDelta: vi.fn().mockResolvedValue(true),
            markInstallmentPaid: vi.fn().mockResolvedValue(true),
            completeScheduledOccurrence: vi.fn().mockResolvedValue(true),
            completePlanIfPaid: vi.fn().mockResolvedValue(undefined),
        } as unknown as FinancingScope;
        const repository: FinancingRepository = { withinTransaction: (work) => work(scope) };
        const useCase = new CompleteFinancingInstallmentUseCase(repository);

        await useCase.execute("user-1", "installment-1", "cash-1", new Date("2026-09-03T12:00:00.000Z"));

        expect(scope.insertPaymentTransfer).toHaveBeenCalledOnce();
        expect(scope.applyBalanceDelta).toHaveBeenCalledTimes(2);
        expect(scope.applyBalanceDelta).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({ id: "cash-1" }),
            "user-1",
            -760,
        );
        expect(scope.applyBalanceDelta).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({ id: "credit-1" }),
            "user-1",
            -760,
        );
        expect(scope.markInstallmentPaid).toHaveBeenCalledOnce();
        expect(scope.completeScheduledOccurrence).toHaveBeenCalledWith(
            "user-1",
            "occurrence-1",
            expect.any(Date),
        );
    });
});
