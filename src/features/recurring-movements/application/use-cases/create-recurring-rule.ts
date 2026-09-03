import { getOccurrencesInHorizon } from "../../domain/recurrence-calculator";
import type {
    RecurringRule, RecurringRuleRepository, RecurringRuleScope,
    RecurringRuleValues,
} from "../../domain/recurring-rule-repository";
import { RecurringRuleError } from "../recurring-rule-error";

const GENERATION_HORIZON_DAYS = 60;

export class CreateRecurringRuleUseCase {
    constructor(private readonly rules: RecurringRuleRepository) { }

    async execute(userId: string, command: RecurringRuleValues, now = new Date()) {
        return this.rules.withinTransaction(async (scope) => {
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

            const rule = await scope.createRule({
                ...command,
                userId,
                currency: account.currency,
            });

            await generateForRule(scope, rule, now);
            return rule;
        });
    }
}

export async function generateForRule(scope: RecurringRuleScope, rule: RecurringRule, now: Date) {
    const horizon = new Date(now.getTime() + GENERATION_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    const occurrences = getOccurrencesInHorizon(rule, now, horizon);
    const inserted = await scope.insertGeneratedOccurrences(
        occurrences.map((occurrence) => ({ ...occurrence, rule })),
    );
    await scope.markGenerated(rule.userId, rule.id, now);
    return inserted;
}
