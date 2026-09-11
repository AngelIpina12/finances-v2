import { describe, expect, it, vi } from "vitest";
import type { FinancingRepository, FinancingScope } from "../../domain/financing-repository";
import { CancelFinancingPlanUseCase } from "./cancel-financing-plan";

describe("CancelFinancingPlanUseCase", () => {
    it("cancela un plan activo y sus recordatorios pendientes", async () => {
        const cancelPlan = vi.fn().mockResolvedValue(true);
        const scope = { cancelPlan } as unknown as FinancingScope;
        const repository: FinancingRepository = { withinTransaction: (work) => work(scope) };
        const useCase = new CancelFinancingPlanUseCase(repository);
        const cancelledAt = new Date("2026-09-08T12:00:00.000Z");

        await useCase.execute("user-1", "plan-1", cancelledAt);

        expect(cancelPlan).toHaveBeenCalledWith("user-1", "plan-1", cancelledAt);
    });
});
