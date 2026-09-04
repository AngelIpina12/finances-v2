import { getBalanceDelta } from "@/src/features/transactions/domain/transaction-rules";
import type { FinancingRepository } from "../../domain/financing-repository";
import { FinancingError } from "../financing-error";

export class CompleteFinancingInstallmentUseCase {
    constructor(private readonly financing: FinancingRepository) { }

    async execute(userId: string, installmentId: string, sourceAccountId: string, paidAt = new Date()) {
        await this.financing.withinTransaction(async (scope) => {
            const installment = await scope.findInstallmentForUpdate(userId, installmentId);

            if (!installment || installment.planStatus !== "active" || installment.paidAt) {
                throw new FinancingError("La cuota ya fue registrada o no está disponible.");
            }

            if (sourceAccountId === installment.creditAccountId) {
                throw new FinancingError("Elige una cuenta distinta de la tarjeta para realizar el pago.");
            }

            const [sourceAccount, creditAccount] = await Promise.all([
                scope.findAccount(userId, sourceAccountId, { activeOnly: true }),
                scope.findAccount(userId, installment.creditAccountId, { activeOnly: true }),
            ]);

            if (!sourceAccount || !creditAccount || creditAccount.type !== "credit") {
                throw new FinancingError("No puedes usar una de las cuentas seleccionadas.");
            }

            if (sourceAccount.currency !== creditAccount.currency || creditAccount.currency !== installment.currency) {
                throw new FinancingError("Las cuentas y la cuota deben usar la misma moneda.");
            }

            const transferGroupId = crypto.randomUUID();
            await scope.insertPaymentTransfer({
                userId,
                transferGroupId,
                installment,
                sourceAccount,
                creditAccount,
                paidAt,
            });

            const [sourceUpdated, creditUpdated] = await Promise.all([
                scope.applyBalanceDelta(
                    sourceAccount,
                    userId,
                    getBalanceDelta(sourceAccount, "transfer", installment.amount, "out"),
                ),
                scope.applyBalanceDelta(
                    creditAccount,
                    userId,
                    getBalanceDelta(creditAccount, "transfer", installment.amount, "in"),
                ),
            ]);

            if (!sourceUpdated || !creditUpdated) {
                throw new FinancingError("No fue posible actualizar los saldos del pago.");
            }

            const paid = await scope.markInstallmentPaid(userId, installment.id, paidAt, transferGroupId);
            const occurrenceCompleted = await scope.completeScheduledOccurrence(
                userId,
                installment.scheduledOccurrenceId,
                paidAt,
            );

            if (!paid || !occurrenceCompleted) {
                throw new FinancingError("La cuota cambió mientras se registraba el pago.");
            }

            await scope.completePlanIfPaid(userId, installment.financingPlanId);
        });
    }
}
