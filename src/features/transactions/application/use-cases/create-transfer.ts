import { getBalanceDelta } from "../../domain/transaction-rules";
import type { CreateTransferCommand, TransactionRepository } from "../../domain/transaction-repository";
import { TransactionError } from "../transaction-error";

export class CreateTransferUseCase {
    constructor(private readonly transactions: TransactionRepository) { }

    async execute(userId: string, command: CreateTransferCommand) {
        if (command.sourceAccountId === command.destinationAccountId) {
            throw new TransactionError("Elige dos cuentas diferentes.");
        }

        await this.transactions.withinTransaction(async (scope) => {
            const [sourceAccount, destinationAccount] = await Promise.all([
                scope.findAccount(userId, command.sourceAccountId, { activeOnly: true }),
                scope.findAccount(userId, command.destinationAccountId, { activeOnly: true }),
            ]);

            if (!sourceAccount || !destinationAccount) {
                throw new TransactionError("No puedes usar una de las cuentas seleccionadas.");
            }

            if (sourceAccount.currency !== destinationAccount.currency) {
                throw new TransactionError(
                    "Por ahora, las transferencias requieren cuentas con la misma moneda.",
                );
            }

            const transferGroupId = crypto.randomUUID();

            await scope.insertCompletedTransfer({
                ...command,
                userId,
                transferGroupId,
                sourceAccount,
                destinationAccount,
            });

            const sourceUpdated = await scope.applyBalanceDelta(
                sourceAccount,
                userId,
                getBalanceDelta(sourceAccount, "transfer", command.amount, "out"),
            );
            const destinationUpdated = await scope.applyBalanceDelta(
                destinationAccount,
                userId,
                getBalanceDelta(destinationAccount, "transfer", command.amount, "in"),
            );

            if (!sourceUpdated || !destinationUpdated) {
                throw new TransactionError("No fue posible actualizar los saldos.");
            }
        });
    }
}
