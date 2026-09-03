import { generateForRule } from "./create-recurring-rule";
import type { RecurringRuleRepository } from "../../domain/recurring-rule-repository";

export class GenerateRecurringOccurrencesUseCase {
    constructor(private readonly rules: RecurringRuleRepository) { }

    async execute(userId: string, ruleId?: string, now = new Date()) {
        return this.rules.withinTransaction(async (scope) => {
            const rules = await scope.findActiveRules(userId, ruleId);
            let generated = 0;

            for (const rule of rules) {
                generated += await generateForRule(scope, rule, now);
            }

            return generated;
        });
    }

    async executeForAllUsers(now = new Date()) {
        return this.rules.withinTransaction(async (scope) => {
            const rules = await scope.findActiveRules();
            let generated = 0;

            for (const rule of rules) {
                generated += await generateForRule(scope, rule, now);
            }

            return { generated, processedRules: rules.length };
        });
    }
}
