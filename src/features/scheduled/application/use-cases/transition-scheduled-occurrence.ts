import type { OccurrenceStatus, ScheduledOccurrenceRepository } from "../../domain/scheduled-occurrence-repository";
import { ScheduledOccurrenceError } from "../scheduled-occurrence-error";

type TerminalStatus = Extract<OccurrenceStatus, "skipped" | "cancelled">;

export class TransitionScheduledOccurrenceUseCase {
    constructor(
        private readonly occurrences: ScheduledOccurrenceRepository,
        private readonly nextStatus: TerminalStatus,
    ) { }

    async execute(userId: string, occurrenceId: string) {
        await this.occurrences.withinTransaction(async (scope) => {
            const occurrence = await scope.findOccurrenceForUpdate(userId, occurrenceId);

            if (!occurrence || occurrence.status !== "scheduled") {
                throw new ScheduledOccurrenceError("El movimiento ya fue atendido o no existe.");
            }

            const updated = await scope.transitionOccurrence(
                userId,
                occurrence.id,
                this.nextStatus,
            );

            if (!updated) {
                throw new ScheduledOccurrenceError("El movimiento cambió mientras lo actualizabas.");
            }
        });
    }
}
