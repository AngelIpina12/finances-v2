import { describe, expect, it } from "vitest";
import type {
    ScheduledOccurrence, ScheduledOccurrenceRepository, ScheduledOccurrenceScope,
} from "../../domain/scheduled-occurrence-repository";
import { ScheduledOccurrenceError } from "../scheduled-occurrence-error";
import { RescheduleScheduledOccurrenceUseCase } from "./reschedule-scheduled-occurrence";

const now = new Date("2026-09-29T18:00:00.000Z");
const originalScheduledAt = new Date("2026-09-25T15:00:00.000Z");
const nextDate = new Date("2026-10-13T15:00:00.000Z");

function setup(overrides: Partial<ScheduledOccurrence> = {}, ruleAcceptsDate = true) {
    const occurrence: ScheduledOccurrence = {
        id: "occurrence-1",
        source: "manual",
        recurringRuleId: null,
        accountId: "account-1",
        categoryId: "category-1",
        transactionType: "income",
        status: "scheduled",
        name: "Pago de cliente",
        amount: 1200,
        currency: "MXN",
        notes: null,
        originalScheduledAt,
        scheduledAt: originalScheduledAt,
        ...overrides,
    };
    const calls = {
        rescheduled: [] as Date[],
        ruleOverrides: [] as Array<{ ruleId: string; originalScheduledAt: Date; scheduledAt: Date }>,
    };
    const scope = {
        findOccurrenceForUpdate: async () => occurrence,
        rescheduleOccurrence: async (_userId: string, _id: string, scheduledAt: Date) => {
            calls.rescheduled.push(scheduledAt);
            return true;
        },
        recordRuleDateOverride: async (input: { ruleId: string; originalScheduledAt: Date; scheduledAt: Date }) => {
            calls.ruleOverrides.push(input);
            return ruleAcceptsDate;
        },
    } as unknown as ScheduledOccurrenceScope;
    const repository: ScheduledOccurrenceRepository = {
        withinTransaction: (work) => work(scope),
    };

    return { useCase: new RescheduleScheduledOccurrenceUseCase(repository), calls };
}

describe("RescheduleScheduledOccurrenceUseCase", () => {
    it("mueve un movimiento manual sin tocar su fecha original", async () => {
        const { useCase, calls } = setup();

        await useCase.execute("user-1", "occurrence-1", nextDate, now);

        expect(calls.rescheduled).toEqual([nextDate]);
        expect(calls.ruleOverrides).toEqual([]);
    });

    it("guarda el cambio en la recurrencia usando la fecha original como clave", async () => {
        const { useCase, calls } = setup({
            source: "recurring_rule",
            recurringRuleId: "rule-1",
            scheduledAt: new Date("2026-10-01T15:00:00.000Z"),
        });

        await useCase.execute("user-1", "occurrence-1", nextDate, now);

        expect(calls.ruleOverrides).toEqual([expect.objectContaining({
            ruleId: "rule-1", originalScheduledAt, scheduledAt: nextDate,
        })]);
        expect(calls.rescheduled).toEqual([nextDate]);
    });

    it("rechaza fechas pasadas, cuotas de financiamiento y fechas fuera de la recurrencia", async () => {
        await expect(setup().useCase.execute("user-1", "occurrence-1", now, now))
            .rejects.toBeInstanceOf(ScheduledOccurrenceError);
        await expect(setup({ source: "financing_installment" }).useCase.execute("user-1", "occurrence-1", nextDate, now))
            .rejects.toBeInstanceOf(ScheduledOccurrenceError);

        const outsideRule = setup({ source: "recurring_rule", recurringRuleId: "rule-1" }, false);
        await expect(outsideRule.useCase.execute("user-1", "occurrence-1", nextDate, now))
            .rejects.toBeInstanceOf(ScheduledOccurrenceError);
        expect(outsideRule.calls.rescheduled).toEqual([]);
    });
});
