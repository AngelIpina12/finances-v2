import { AccountError } from "../account-error";
import type { CreditCardPaymentSettingsInput, CreditCardPaymentSettingsRepository } from "../../domain/credit-card-payment-settings-repository";

export class SaveCreditCardPaymentSettingsUseCase {
    constructor(private readonly settings: CreditCardPaymentSettingsRepository) { }

    async execute(userId: string, input: CreditCardPaymentSettingsInput) {
        return this.settings.withinTransaction(async (scope) => {
            const [creditAccount, sourceAccount] = await Promise.all([
                scope.findAccount(userId, input.creditAccountId),
                scope.findAccount(userId, input.sourceAccountId),
            ]);

            if (!creditAccount || creditAccount.type !== "credit") {
                throw new AccountError("Selecciona una tarjeta de crédito válida.");
            }

            if (
                !sourceAccount
                || !sourceAccount.includeInLiquidity
                || !["cash", "debit", "wallet"].includes(sourceAccount.type)
            ) {
                throw new AccountError("La cuenta de pago debe ser una cuenta líquida activa.");
            }

            if (creditAccount.id === sourceAccount.id || creditAccount.currency !== sourceAccount.currency) {
                throw new AccountError("La cuenta de pago debe ser distinta y usar la misma moneda que la tarjeta.");
            }

            await scope.save(userId, input);
        });
    }
}
