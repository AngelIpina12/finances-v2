import { describe, expect, it } from "vitest";
import type {
    ScheduledOccurrence, ScheduledOccurrenceRepository, ScheduledOccurrenceScope,
} from "../../domain/scheduled-occurrence-repository";
import { CompleteScheduledOccurrenceUseCase } from "./complete-scheduled-occurrence";

describe("CompleteScheduledOccurrenceUseCase", () => {
    it("aplica el saldo y crea la transacción una sola vez ante doble confirmación", async () => {
        const occurrence: ScheduledOccurrence = {
            id: "occurrence-1",
            source: "manual",
            accountId: "account-1",
            categoryId: "category-1",
            transactionType: "expense",
            status: "scheduled",
            name: "Renta",
            amount: 1200,
            currency: "MXN",
            notes: null,
            scheduledAt: new Date("2026-09-03T15:00:00.000Z"),
        };
        let insertedTransactions = 0;
        let appliedBalance = 0;

        const scope = {
            findOccurrenceForUpdate: async () => occurrence,
            findAccount: async () => ({
                id: "account-1",
                type: "debit" as const,
                currency: "MXN" as const,
                creditLimit: null,
                owedAmount: null,
            }),
            categoryBelongsToType: async () => true,
            insertCompletedTransaction: async () => {
                insertedTransactions += 1;
            },
            applyBalanceDelta: async (_account: unknown, _userId: string, delta: number) => {
                appliedBalance += delta;
                return true;
            },
            transitionOccurrence: async () => {
                if (occurrence.status !== "scheduled") return false;
                occurrence.status = "completed";
                return true;
            },
        } as unknown as ScheduledOccurrenceScope;
        const repository: ScheduledOccurrenceRepository = {
            withinTransaction: (work) => work(scope),
        };
        const useCase = new CompleteScheduledOccurrenceUseCase(repository);

        await useCase.execute("user-1", occurrence.id);

        await expect(useCase.execute("user-1", occurrence.id)).rejects.toThrow(
            "El movimiento ya fue atendido o no existe.",
        );
        expect(insertedTransactions).toBe(1);
        expect(appliedBalance).toBe(-1200);
        expect(occurrence.status).toBe("completed");
    });
});
