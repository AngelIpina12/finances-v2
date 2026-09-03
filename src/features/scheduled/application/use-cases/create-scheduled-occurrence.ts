import type { CreateScheduledOccurrenceCommand, ScheduledOccurrenceRepository } from "../../domain/scheduled-occurrence-repository";
import { ScheduledOccurrenceError } from "../scheduled-occurrence-error";

export class CreateScheduledOccurrenceUseCase {
    constructor(private readonly occurrences: ScheduledOccurrenceRepository) { }

    async execute(userId: string, command: CreateScheduledOccurrenceCommand) {
        await this.occurrences.withinTransaction(async (scope) => {
            const account = await scope.findAccount(userId, command.accountId, {
                activeOnly: true,
            });

            if (!account) {
                throw new ScheduledOccurrenceError("No puedes usar esa cuenta.");
            }

            const categoryMatches = await scope.categoryBelongsToType(
                userId,
                command.categoryId,
                command.transactionType,
                { activeOnly: true },
            );

            if (!categoryMatches) {
                throw new ScheduledOccurrenceError("La categoría no corresponde al tipo de movimiento.");
            }

            await scope.insertOccurrence({ ...command, userId, currency: account.currency });
        });
    }
}
