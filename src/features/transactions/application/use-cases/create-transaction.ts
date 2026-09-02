import { getBalanceDelta } from "../../domain/transaction-rules";
import type { CreateTransactionCommand, TransactionRepository } from "../../domain/transaction-repository";
import { TransactionError } from "../transaction-error";

export class CreateTransactionUseCase {
    constructor(private readonly transactions: TransactionRepository) { }

    async execute(userId: string, command: CreateTransactionCommand) {
        await this.transactions.withinTransaction(async (scope) => {
            const account = await scope.findAccount(userId, command.accountId, {
                activeOnly: true,
            });

            if (!account) {
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

            await scope.insertCompletedTransaction({
                ...command,
                userId,
                currency: account.currency,
            });

            const updated = await scope.applyBalanceDelta(
                account,
                userId,
                getBalanceDelta(account, command.type, command.amount),
            );

            if (!updated) {
                throw new TransactionError("No fue posible actualizar el saldo.");
            }
        });
    }
}
