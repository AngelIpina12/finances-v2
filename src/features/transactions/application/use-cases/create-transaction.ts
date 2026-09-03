import {
    getBalanceDelta, requiresCreditOverLimitApproval,
} from "../../domain/transaction-rules";
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

            const balanceDelta = getBalanceDelta(
                account,
                command.type,
                command.amount,
            );

            if (
                requiresCreditOverLimitApproval(account, balanceDelta)
                && !command.allowCreditOverLimit
            ) {
                throw new TransactionError(
                    "El movimiento excede el límite de crédito. Confirma que deseas registrarlo de todos modos.",
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
                balanceDelta,
            );

            if (!updated) {
                throw new TransactionError("No fue posible actualizar el saldo.");
            }
        });
    }
}
