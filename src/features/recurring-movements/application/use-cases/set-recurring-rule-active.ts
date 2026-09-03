import { generateForRule } from "./create-recurring-rule";
import type { RecurringRuleRepository } from "../../domain/recurring-rule-repository";
import { RecurringRuleError } from "../recurring-rule-error";

export class SetRecurringRuleActiveUseCase {
    constructor(
        private readonly rules: RecurringRuleRepository,
        private readonly active: boolean,
    ) { }

    async execute(userId: string, ruleId: string, now = new Date()) {
        return this.rules.withinTransaction(async (scope) => {
            const rule = await scope.setActive(userId, ruleId, this.active);

            if (!rule) {
                throw new RecurringRuleError("La recurrencia ya no está disponible.");
            }

            if (this.active) {
                await generateForRule(scope, rule, now);
            }

            return rule;
        });
    }
}
