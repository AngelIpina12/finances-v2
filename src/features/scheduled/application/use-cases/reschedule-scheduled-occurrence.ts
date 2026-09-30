import type { ScheduledOccurrenceRepository } from "../../domain/scheduled-occurrence-repository";
import { ScheduledOccurrenceError } from "../scheduled-occurrence-error";

export class RescheduleScheduledOccurrenceUseCase {
    constructor(private readonly occurrences: ScheduledOccurrenceRepository) { }

    async execute(userId: string, occurrenceId: string, scheduledAt: Date, now = new Date()) {
        if (scheduledAt <= now) {
            throw new ScheduledOccurrenceError("Elige una fecha y hora posteriores a este momento.");
        }

        await this.occurrences.withinTransaction(async (scope) => {
            const occurrence = await scope.findOccurrenceForUpdate(userId, occurrenceId);

            if (!occurrence || occurrence.status !== "scheduled") {
                throw new ScheduledOccurrenceError("El movimiento ya fue atendido o no existe.");
            }

            if (occurrence.source === "financing_installment") {
                throw new ScheduledOccurrenceError("Las cuotas de financiamiento siguen el calendario de su plan.");
            }

            // La fecha original nunca cambia: queda como registro de cuándo se
            // tenía contemplado el movimiento, aunque se recorra varias veces.
            if (occurrence.recurringRuleId) {
                const recorded = await scope.recordRuleDateOverride({
                    userId,
                    ruleId: occurrence.recurringRuleId,
                    originalScheduledAt: occurrence.originalScheduledAt,
                    scheduledAt,
                });

                if (!recorded) {
                    throw new ScheduledOccurrenceError("La nueva fecha queda fuera de la vigencia de la recurrencia.");
                }
            }

            const updated = await scope.rescheduleOccurrence(userId, occurrence.id, scheduledAt);

            if (!updated) {
                throw new ScheduledOccurrenceError("El movimiento cambió mientras lo actualizabas.");
            }
        });
    }
}
