import type {
    CreateTransactionCommand,
    TransactionRepository,
} from "../../domain/transaction-repository";

export class CreateTransactionError extends Error {}

export class CreateTransactionUseCase {
    constructor(private readonly transactions: TransactionRepository) {}

    async execute(userId: string, command: CreateTransactionCommand) {
        await this.transactions.withinTransaction(async (scope) => {
            const account = await scope.findActiveAccount(userId, command.accountId);

            if (!account) {
                throw new CreateTransactionError("No puedes usar esa cuenta.");
            }

            const categoryMatchesType = await scope.categoryBelongsToType(
                userId,
                command.categoryId,
                command.type,
            );

            if (!categoryMatchesType) {
                throw new CreateTransactionError(
                    "La categoría no corresponde al tipo de movimiento.",
                );
            }

            const delta = account.type === "credit"
                ? command.type === "expense" ? command.amount : -command.amount
                : command.type === "income" ? command.amount : -command.amount;

            await scope.insertCompletedTransaction({
                ...command,
                userId,
                currency: account.currency,
            });

            const updated = await scope.applyBalanceDelta(account, userId, delta);

            if (!updated) {
                throw new CreateTransactionError("No fue posible actualizar el saldo.");
            }
        });
    }
}
