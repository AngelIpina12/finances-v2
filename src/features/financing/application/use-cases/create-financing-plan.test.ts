import { describe, expect, it, vi } from "vitest";
import type {
    FinancingRepository, FinancingScope, InstallmentDraft,
} from "../../domain/financing-repository";
import { CreateFinancingPlanUseCase } from "./create-financing-plan";

describe("CreateFinancingPlanUseCase", () => {
    it("marca como pagadas las cuotas históricas sin registrar transferencias", async () => {
        const createInstallments = vi.fn().mockResolvedValue(undefined);
        const completePlanIfPaid = vi.fn().mockResolvedValue(undefined);
        const scope = {
            findEligiblePurchaseForUpdate: vi.fn().mockResolvedValue({
                id: "purchase-1",
                accountId: "credit-1",
                categoryId: null,
                amount: 300,
                currency: "MXN",
                merchant: "Compra",
                date: new Date("2026-06-01T12:00:00.000Z"),
            }),
            createPlan: vi.fn().mockResolvedValue({ id: "plan-1" }),
            linkPurchaseToPlan: vi.fn().mockResolvedValue(true),
            createInstallments,
            completePlanIfPaid,
        } as unknown as FinancingScope;
        const repository: FinancingRepository = { withinTransaction: (work) => work(scope) };
        const useCase = new CreateFinancingPlanUseCase(repository);

        await useCase.execute("user-1", {
            purchaseTransactionId: "purchase-1",
            name: "Compra",
            regularInstallmentCount: 4,
            regularInstallmentAmount: 75,
            balloonAmount: 0,
            startsAt: new Date("2026-06-16T12:00:00.000Z"),
        }, new Date("2026-09-08T12:00:00.000Z"));

        const installments = createInstallments.mock.calls[0]?.[0].installments;

        expect(installments).toHaveLength(4);
        expect(installments?.slice(0, 3).every((installment: InstallmentDraft) => installment.paidAt)).toBe(true);
        expect(installments?.[3]?.paidAt).toBeNull();
        expect(completePlanIfPaid).toHaveBeenCalledWith("user-1", "plan-1");
    });
});
