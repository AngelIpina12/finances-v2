import { BudgetError } from "../budget-error";
import type { BudgetRepository } from "../../domain/budget-repository";

export class ArchiveBudgetUseCase {
    constructor(private readonly budgets: BudgetRepository) {}

    async execute(userId: string, budgetId: string) {
        const archived = await this.budgets.archive(userId, budgetId);

        if (!archived) {
            throw new BudgetError("El presupuesto ya no está disponible.");
        }
    }
}
