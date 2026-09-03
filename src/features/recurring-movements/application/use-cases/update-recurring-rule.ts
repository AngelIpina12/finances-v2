import { generateForRule } from "./create-recurring-rule";
import type { RecurringRuleRepository, RecurringRuleValues } from "../../domain/recurring-rule-repository";
import { RecurringRuleError } from "../recurring-rule-error";

export class UpdateRecurringRuleUseCase {
    constructor(private readonly rules: RecurringRuleRepository) { }

    async execute(userId: string, ruleId: string, command: RecurringRuleValues, now = new Date()) {
        return this.rules.withinTransaction(async (scope) => {
            const existing = await scope.findRuleForUpdate(userId, ruleId);

            if (!existing) {
                throw new RecurringRuleError("La recurrencia ya no está disponible.");
            }

            const account = await scope.findAccount(userId, command.accountId, {
                activeOnly: true,
            });

            if (!account) {
                throw new RecurringRuleError("No puedes usar esa cuenta.");
            }

            const categoryMatches = await scope.categoryBelongsToType(
                userId,
                command.categoryId,
                command.transactionType,
            );

            if (!categoryMatches) {
                throw new RecurringRuleError("La categoría no corresponde al tipo de movimiento.");
            }

            const updated = await scope.updateRule(userId, ruleId, {
                ...command,
                currency: account.currency,
            });

            if (!updated) {
                throw new RecurringRuleError("No fue posible actualizar la recurrencia.");
            }

            if (updated.isActive) {
                await generateForRule(scope, updated, now);
            }

            return updated;
        });
    }
}
