import type { BudgetFormData } from "../schemas/budget.schema";

export interface BudgetRepository {
    save(userId: string, input: BudgetFormData): Promise<void>;
    archive(userId: string, budgetId: string): Promise<boolean>;
}
