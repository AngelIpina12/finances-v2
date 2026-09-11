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
    const defaultHorizon = new Date(now.getTime() + GENERATION_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    const lastCustomEntry = rule.frequency === "custom"
        ? rule.calendarEntries.reduce<Date | null>(
            (latest, entry) => !latest || entry.scheduledAt > latest ? entry.scheduledAt : latest,
            null,
        )
        : null;
    // Un calendario personalizado expresa fechas explícitas; todas las que el
    // usuario ya conoce deben aparecer, incluso si están después del horizonte
    // habitual de generación de recurrencias.
    const horizon = lastCustomEntry && lastCustomEntry >= defaultHorizon
        ? new Date(lastCustomEntry.getTime() + 1)
        : defaultHorizon;
    const occurrences = getOccurrencesInHorizon(rule, now, horizon);
    const inserted = await scope.insertGeneratedOccurrences(
        occurrences.map((occurrence) => ({ ...occurrence, rule })),
    );
    await scope.markGenerated(rule.userId, rule.id, now);
    return inserted;
}
