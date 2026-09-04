import {
    getBalanceDelta, requiresCreditOverLimitApproval,
} from "@/src/features/transactions/domain/transaction-rules";
import type { ScheduledOccurrenceRepository } from "../../domain/scheduled-occurrence-repository";
import { ScheduledOccurrenceError } from "../scheduled-occurrence-error";

export class CompleteScheduledOccurrenceUseCase {
    constructor(private readonly occurrences: ScheduledOccurrenceRepository) { }

    async execute(
        userId: string,
        occurrenceId: string,
        options: { allowCreditOverLimit?: boolean } = {},
        executedAt = new Date(),
    ) {
        await this.occurrences.withinTransaction(async (scope) => {
            const occurrence = await scope.findOccurrenceForUpdate(userId, occurrenceId);

            if (!occurrence || occurrence.status !== "scheduled") {
                throw new ScheduledOccurrenceError("El movimiento ya fue atendido o no existe.");
            }

            if (occurrence.source === "financing_installment") {
                throw new ScheduledOccurrenceError("Registra el pago de esta cuota desde Financiamientos.");
            }

            const account = await scope.findAccount(userId, occurrence.accountId, { activeOnly: true });

            if (!account) {
                throw new ScheduledOccurrenceError("La cuenta ya no está disponible.");
            }

            if (!occurrence.categoryId) {
                throw new ScheduledOccurrenceError("La categoría ya no está disponible.");
            }

            const categoryMatches = await scope.categoryBelongsToType(
                userId,
                occurrence.categoryId,
                occurrence.transactionType,
            );

            if (!categoryMatches) {
                throw new ScheduledOccurrenceError("La categoría ya no corresponde al movimiento.");
            }

            const balanceDelta = getBalanceDelta(
                account,
                occurrence.transactionType,
                occurrence.amount,
            );

            if (
                requiresCreditOverLimitApproval(account, balanceDelta)
                && !options.allowCreditOverLimit
            ) {
                throw new ScheduledOccurrenceError(
                    "El movimiento excede el límite de crédito. Confirma que deseas registrarlo de todos modos.",
                );
            }

            await scope.insertCompletedTransaction({ userId, occurrence, executedAt });

            const balanceUpdated = await scope.applyBalanceDelta(
                account,
                userId,
                balanceDelta,
            );

            if (!balanceUpdated) {
                throw new ScheduledOccurrenceError("No fue posible actualizar el saldo.");
            }

            const occurrenceUpdated = await scope.transitionOccurrence(userId, occurrence.id, "completed", executedAt);

            if (!occurrenceUpdated) {
                throw new ScheduledOccurrenceError("El movimiento cambió mientras se completaba.");
            }
        });
    }
}
