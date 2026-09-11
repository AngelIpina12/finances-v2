import { buildInstallmentSchedule } from "../../domain/installment-schedule";
import type { FinancingPlanInput, FinancingRepository } from "../../domain/financing-repository";
import { FinancingError } from "../financing-error";

function toCents(amount: number) {
    return Math.round(amount * 100);
}

export class CreateFinancingPlanUseCase {
    constructor(private readonly financing: FinancingRepository) { }

    async execute(userId: string, command: FinancingPlanInput, now = new Date()) {
        return this.financing.withinTransaction(async (scope) => {
            const purchase = await scope.findEligiblePurchaseForUpdate(userId, command.purchaseTransactionId);

            if (!purchase) {
                throw new FinancingError("Selecciona una compra vigente hecha con una tarjeta de crédito.");
            }

            if (command.paymentAccountId) {
                const paymentAccount = await scope.findAccount(userId, command.paymentAccountId, {
                    activeOnly: true,
                });

                if (!paymentAccount || paymentAccount.type === "credit" || paymentAccount.currency !== purchase.currency) {
                    throw new FinancingError("La cuenta prevista debe estar activa, no ser de crédito y usar la misma moneda.");
                }
            }

            const scheduledTotal = command.regularInstallmentCount * command.regularInstallmentAmount
                + command.balloonAmount;
            const roundingDifferenceCents = toCents(purchase.amount) - toCents(scheduledTotal);
            const canDistributeRoundingDifference = command.regularInstallmentCount > 1
                && Math.abs(roundingDifferenceCents) < command.regularInstallmentCount;

            if (roundingDifferenceCents !== 0 && !canDistributeRoundingDifference) {
                throw new FinancingError("La suma de las cuotas debe coincidir exactamente con la compra original.");
            }

            const plan = await scope.createPlan({
                ...command,
                userId,
                creditAccountId: purchase.accountId,
                totalAmount: purchase.amount,
                currency: purchase.currency,
            });
            const linked = await scope.linkPurchaseToPlan(userId, purchase.id, plan.id);

            if (!linked) {
                throw new FinancingError("La compra cambió mientras se creaba el financiamiento.");
            }

            const installments = buildInstallmentSchedule({
                ...command,
                regularInstallmentAdjustmentCents: roundingDifferenceCents,
            }).map((installment) => ({
                ...installment,
                // Los pagos previos al alta del plan ya ocurrieron fuera de la app;
                // se conservan como historial sin crear transferencias duplicadas.
                paidAt: installment.scheduledAt < now ? installment.scheduledAt : null,
            }));

            await scope.createInstallments({
                plan,
                purchase,
                installments,
            });

            await scope.completePlanIfPaid(userId, plan.id);

            return plan;
        });
    }
}
