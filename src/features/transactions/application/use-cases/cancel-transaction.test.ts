import { describe, expect, it, vi } from "vitest";
import type { TransactionRepository, TransactionScope } from "../../domain/transaction-repository";
import { CancelTransactionUseCase } from "./cancel-transaction";

describe("CancelTransactionUseCase", () => {
    it("reabre la cuota y su ocurrencia al cancelar un pago de financiamiento", async () => {
        const sourceMovement = {
            id: "transfer-out",
            accountId: "debit-1",
            categoryId: null,
            scheduledOccurrenceId: "occurrence-1",
            financingPlanId: "plan-1",
            financingInstallmentId: "installment-1",
            transferGroupId: "group-1",
            transferDirection: "out" as const,
            type: "transfer" as const,
            amount: 2500,
        };
        const destinationMovement = {
            ...sourceMovement,
            id: "transfer-in",
            accountId: "credit-1",
            scheduledOccurrenceId: null,
            transferDirection: "in" as const,
        };
        const scope = {
            findCompletedTransaction: vi.fn().mockResolvedValue(sourceMovement),
            findCompletedTransfer: vi.fn().mockResolvedValue([sourceMovement, destinationMovement]),
            findAccount: vi.fn()
                .mockResolvedValueOnce({ id: "debit-1", type: "debit", currency: "MXN", creditLimit: null, owedAmount: null })
                .mockResolvedValueOnce({ id: "credit-1", type: "credit", currency: "MXN", creditLimit: 10000, owedAmount: 2500 }),
            applyBalanceDelta: vi.fn().mockResolvedValue(true),
            cancelTransactions: vi.fn().mockResolvedValue(2),
            reopenFinancingInstallments: vi.fn().mockResolvedValue(1),
            reopenScheduledOccurrences: vi.fn().mockResolvedValue(1),
            cancelScheduledOccurrences: vi.fn(),
        } as unknown as TransactionScope;
        const repository: TransactionRepository = {
            withinTransaction: (work) => work(scope),
        };
        const useCase = new CancelTransactionUseCase(repository);

        await useCase.execute("user-1", sourceMovement.id);

        expect(scope.cancelTransactions).toHaveBeenCalledWith("user-1", ["transfer-out", "transfer-in"]);
        expect(scope.reopenFinancingInstallments).toHaveBeenCalledWith("user-1", ["installment-1"]);
        expect(scope.reopenScheduledOccurrences).toHaveBeenCalledWith("user-1", ["occurrence-1"]);
        expect(scope.cancelScheduledOccurrences).not.toHaveBeenCalled();
    });
});
