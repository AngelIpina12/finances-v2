import type { RecurringRuleRepository } from "../../domain/recurring-rule-repository";
import { RecurringRuleError } from "../recurring-rule-error";

export class ArchiveRecurringRuleUseCase {
    constructor(private readonly rules: RecurringRuleRepository) { }

    async execute(userId: string, ruleId: string) {
        await this.rules.withinTransaction(async (scope) => {
            const archived = await scope.archiveRule(userId, ruleId);

            if (!archived) {
                throw new RecurringRuleError("La recurrencia ya no está disponible.");
            }
        });
    }
}
