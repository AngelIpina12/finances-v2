import { subMonths } from "date-fns";
import { getBalanceDelta } from "@/src/features/transactions/domain/transaction-rules";
import type { CardStatementRepository } from "../../domain/card-statement-repository";
import { getLatestCycleClose, getPaymentDueAt } from "../../domain/credit-card-cycle";
import { ForecastError } from "../forecast-error";

export class PayCardStatementUseCase {
    constructor(private readonly repository: CardStatementRepository) { }

    async execute(
        userId: string,
        input: { creditAccountId: string; sourceAccountId: string },
        now = new Date(),
    ) {
        return this.repository.withinTransaction(async (scope) => {
            const card = await scope.findCard(userId, input.creditAccountId);

            if (!card) {
                throw new ForecastError("La tarjeta no está disponible.");
            }

            if (input.sourceAccountId === card.id) {
                throw new ForecastError("Elige una cuenta distinta de la tarjeta para realizar el pago.");
            }

            const [sourceAccount, creditAccount] = await Promise.all([
                scope.findAccount(userId, input.sourceAccountId, { activeOnly: true }),
                scope.findAccount(userId, card.id, { activeOnly: true }),
            ]);

            if (!sourceAccount || !creditAccount || creditAccount.type !== "credit") {
                throw new ForecastError("No puedes usar una de las cuentas seleccionadas.");
            }

            if (sourceAccount.currency !== card.currency) {
                throw new ForecastError("La cuenta de pago debe usar la misma moneda que la tarjeta.");
            }

            const paymentTermDays = await scope.getPaymentTermDays(userId, card.id) ?? 20;
            const closesAt = getLatestCycleClose(now, card.billingDate);
            const cycleStartsAt = subMonths(closesAt, 1);
            const dueAt = getPaymentDueAt(closesAt, paymentTermDays);

            const [regularCharges, cycleCredits, paymentsSinceClose, unpaidInstallments] = await Promise.all([
                scope.sumRegularCharges(userId, card.id, cycleStartsAt, closesAt),
                scope.sumCycleCredits(userId, card.id, cycleStartsAt, closesAt),
                scope.sumPaymentsSinceClose(userId, card.id, closesAt, now),
                scope.findUnpaidInstallmentsDue(userId, card.id, dueAt),
            ]);

            // Las bonificaciones del ciclo cancelan primero los cargos regulares,
            // igual que en el cálculo de previsión.
            const purchases = Math.max(0, regularCharges - cycleCredits);
            const installmentsTotal = unpaidInstallments.reduce((sum, installment) => sum + installment.amount, 0);
            const amount = Math.max(
                0,
                Math.round((purchases + installmentsTotal - paymentsSinceClose) * 100) / 100,
            );

            if (amount <= 0) {
                throw new ForecastError("No hay saldo pendiente para este estado de cuenta.");
            }

            const transferGroupId = crypto.randomUUID();
            const paidAt = now;

            await scope.insertStatementPayment({
                userId, transferGroupId, card, sourceAccount, amount, paidAt,
            });

            const [sourceUpdated, creditUpdated] = await Promise.all([
                scope.applyBalanceDelta(
                    sourceAccount,
                    userId,
                    getBalanceDelta(sourceAccount, "transfer", amount, "out"),
                ),
                scope.applyBalanceDelta(
                    creditAccount,
                    userId,
                    getBalanceDelta(creditAccount, "transfer", amount, "in"),
                ),
            ]);

            if (!sourceUpdated || !creditUpdated) {
                throw new ForecastError("No fue posible actualizar los saldos del pago.");
            }

            if (unpaidInstallments.length > 0) {
                const installmentIds = unpaidInstallments.map((installment) => installment.id);
                const occurrenceIds = unpaidInstallments.map((installment) => installment.scheduledOccurrenceId);
                const planIds = [...new Set(unpaidInstallments.map((installment) => installment.financingPlanId))];

                await scope.markInstallmentsPaid(userId, installmentIds, paidAt, transferGroupId);
                await scope.completeScheduledOccurrences(userId, occurrenceIds, paidAt);
                await scope.completePlansIfPaid(userId, planIds);
            }

            return { amount, installmentsSettled: unpaidInstallments.length };
        });
    }
}
