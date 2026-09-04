import { buildInstallmentSchedule } from "../../domain/installment-schedule";
import type { FinancingPlanInput, FinancingRepository } from "../../domain/financing-repository";
import { FinancingError } from "../financing-error";

function toCents(amount: number) {
    return Math.round(amount * 100);
}

export class CreateFinancingPlanUseCase {
    constructor(private readonly financing: FinancingRepository) { }

    async execute(userId: string, command: FinancingPlanInput) {
        return this.financing.withinTransaction(async (scope) => {
            const purchase = await scope.findEligiblePurchaseForUpdate(userId, command.purchaseTransactionId);

            if (!purchase) {
                throw new FinancingError("Selecciona una compra vigente hecha con una tarjeta de crédito.");
            }

            const scheduledTotal = command.regularInstallmentCount * command.regularInstallmentAmount
                + command.balloonAmount;

            if (toCents(scheduledTotal) !== toCents(purchase.amount)) {
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

            await scope.createInstallments({
                plan,
                purchase,
                installments: buildInstallmentSchedule(command),
            });

            return plan;
        });
    }
}
