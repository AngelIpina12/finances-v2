import { getBalanceDelta, isEditableTransactionType } from "../../domain/transaction-rules";
import type { TransactionRepository, UpdateTransactionCommand } from "../../domain/transaction-repository";
import { TransactionError } from "../transaction-error";

export class UpdateTransactionUseCase {
    constructor(private readonly transactions: TransactionRepository) { }

    async execute(userId: string, command: UpdateTransactionCommand) {
        await this.transactions.withinTransaction(async (scope) => {
            const original = await scope.findCompletedTransaction(userId, command.id);

            if (!original || !isEditableTransactionType(original.type)) {
                throw new TransactionError("El movimiento no se puede editar.");
            }

            const [originalAccount, nextAccount] = await Promise.all([
                scope.findAccount(userId, original.accountId),
                scope.findAccount(userId, command.accountId, { activeOnly: true }),
            ]);

            if (!originalAccount || !nextAccount) {
                throw new TransactionError("No puedes usar esa cuenta.");
            }

            const categoryMatchesType = await scope.categoryBelongsToType(
                userId,
                command.categoryId,
                command.type,
            );

            if (!categoryMatchesType) {
                throw new TransactionError(
                    "La categoría no corresponde al tipo de movimiento.",
                );
            }

            const reverted = await scope.applyBalanceDelta(
                originalAccount,
                userId,
                -getBalanceDelta(originalAccount, original.type, original.amount),
            );
            const applied = await scope.applyBalanceDelta(
                nextAccount,
                userId,
                getBalanceDelta(nextAccount, command.type, command.amount),
            );

            if (!reverted || !applied) {
                throw new TransactionError("No fue posible recalcular los saldos.");
            }

            const updated = await scope.updateCompletedTransaction(userId, {
                ...command,
                currency: nextAccount.currency,
            });

            if (!updated) {
                throw new TransactionError("El movimiento cambió mientras lo editabas.");
            }
        });
    }
}
