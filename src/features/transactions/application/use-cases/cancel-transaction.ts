import { getBalanceDelta } from "../../domain/transaction-rules";
import type { TransactionRepository } from "../../domain/transaction-repository";
import { TransactionError } from "../transaction-error";

export class CancelTransactionUseCase {
    constructor(private readonly transactions: TransactionRepository) { }

    async execute(userId: string, transactionId: string) {
        await this.transactions.withinTransaction(async (scope) => {
            const selected = await scope.findCompletedTransaction(userId, transactionId);

            if (!selected) {
                throw new TransactionError("El movimiento ya fue cancelado o no existe.");
            }

            const movements = selected.transferGroupId
                ? await scope.findCompletedTransfer(userId, selected.transferGroupId)
                : [selected];

            if (selected.transferGroupId && movements.length !== 2) {
                throw new TransactionError("La transferencia está incompleta y no puede cancelarse.");
            }

            for (const movement of movements) {
                const account = await scope.findAccount(userId, movement.accountId);

                if (!account) {
                    throw new TransactionError("No fue posible encontrar la cuenta afectada.");
                }

                const reverted = await scope.applyBalanceDelta(
                    account,
                    userId,
                    -getBalanceDelta(account, movement.type, movement.amount, movement.transferDirection),
                );

                if (!reverted) {
                    throw new TransactionError("No fue posible revertir el saldo.");
                }
            }

            const cancelled = await scope.cancelTransactions(userId, movements.map((movement) => movement.id));

            if (cancelled !== movements.length) {
                throw new TransactionError("El movimiento cambió mientras se cancelaba.");
            }

            const occurrenceIds = [...new Set(movements.flatMap((movement) => (
                movement.scheduledOccurrenceId
                    ? [movement.scheduledOccurrenceId]
                    : []
            )))];
            const financingInstallmentIds = [...new Set(movements.flatMap((movement) => (
                movement.financingInstallmentId
                    ? [movement.financingInstallmentId]
                    : []
            )))];

            if (financingInstallmentIds.length) {
                const reopenedInstallments = await scope.reopenFinancingInstallments(
                    userId,
                    financingInstallmentIds,
                );

                if (reopenedInstallments !== financingInstallmentIds.length) {
                    throw new TransactionError("No fue posible reabrir la cuota del financiamiento.");
                }

                const reopenedOccurrences = await scope.reopenScheduledOccurrences(userId, occurrenceIds);

                if (reopenedOccurrences !== occurrenceIds.length) {
                    throw new TransactionError("No fue posible reabrir el pago programado.");
                }

                return;
            }

            const cancelledOccurrences = await scope.cancelScheduledOccurrences(userId, occurrenceIds);

            if (cancelledOccurrences !== occurrenceIds.length) {
                throw new TransactionError("No fue posible sincronizar el movimiento programado.");
            }
        });
    }
}
