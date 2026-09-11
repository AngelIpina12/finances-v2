import type { FinancingRepository } from "../../domain/financing-repository";
import { FinancingError } from "../financing-error";

export class CancelFinancingPlanUseCase {
    constructor(private readonly financing: FinancingRepository) { }

    async execute(userId: string, planId: string, cancelledAt = new Date()) {
        await this.financing.withinTransaction(async (scope) => {
            const cancelled = await scope.cancelPlan(userId, planId, cancelledAt);

            if (!cancelled) {
                throw new FinancingError("El financiamiento no está disponible para cancelarse.");
            }
        });
    }
}
