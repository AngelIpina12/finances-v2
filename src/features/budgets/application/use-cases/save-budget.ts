import type { BudgetRepository } from "../../domain/budget-repository";
import type { BudgetFormData } from "../../schemas/budget.schema";

export class SaveBudgetUseCase {
    constructor(private readonly budgets: BudgetRepository) {}

    execute(userId: string, input: BudgetFormData) {
        return this.budgets.save(userId, input);
    }
}
