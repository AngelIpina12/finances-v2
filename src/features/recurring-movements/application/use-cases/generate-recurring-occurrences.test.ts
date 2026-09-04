import { describe, expect, it } from "vitest";
import { fromZonedTime } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/src/shared/constants/date-time";
import type {
    RecurringRule, RecurringRuleRepository, RecurringRuleScope,
} from "../../domain/recurring-rule-repository";
import { GenerateRecurringOccurrencesUseCase } from "./generate-recurring-occurrences";

function recurringRule(overrides: Partial<RecurringRule> = {}): RecurringRule {
    return {
        id: "rule-1",
        userId: "user-1",
        accountId: "account-1",
        categoryId: "category-1",
        transactionType: "expense",
        frequency: "weekly",
        amountStrategy: "fixed",
        fifthOccurrencePolicy: "keep_fixed",
        name: "Renta",
        amount: 1000,
        periodTotal: null,
        fifthOccurrenceAmount: null,
        currency: "MXN",
        notes: null,
        semimonthlyFirstDay: null,
        semimonthlySecondDay: null,
        calendarEntries: [],
        dateOverrides: [],
        startsAt: fromZonedTime("2026-09-03T09:00:00", APP_TIME_ZONE),
        endsAt: null,
        isActive: true,
        ...overrides,
    };
}

class InMemoryRecurringRuleRepository implements RecurringRuleRepository {
    readonly occurrences = new Map<string, { ruleId: string; sequence: number }>();
    readonly generatedAt = new Map<string, Date>();

    constructor(private readonly rules: RecurringRule[]) { }

    async withinTransaction<T>(work: (scope: RecurringRuleScope) => Promise<T>) {
        const scope = {
            findActiveRules: async (userId?: string, ruleId?: string) => this.rules.filter((rule) => (
                rule.isActive
                && (!userId || rule.userId === userId)
                && (!ruleId || rule.id === ruleId)
            )),
            insertGeneratedOccurrences: async (items: Array<{
                rule: RecurringRule;
                sequence: number;
            }>) => {
                await Promise.resolve();
                let inserted = 0;

                for (const item of items) {
                    const key = `${item.rule.id}:${item.sequence}`;
                    if (this.occurrences.has(key)) continue;
                    this.occurrences.set(key, {
                        ruleId: item.rule.id,
                        sequence: item.sequence,
                    });
                    inserted += 1;
                }

                return inserted;
            },
            markGenerated: async (_userId: string, ruleId: string, generatedAt: Date) => {
                this.generatedAt.set(ruleId, generatedAt);
            },
        } as unknown as RecurringRuleScope;

        return work(scope);
    }
}

describe("GenerateRecurringOccurrencesUseCase", () => {
    const now = fromZonedTime("2026-09-03T08:00:00", APP_TIME_ZONE);

    it("no duplica ocurrencias al repetir la misma ejecución", async () => {
        const repository = new InMemoryRecurringRuleRepository([recurringRule()]);
        const useCase = new GenerateRecurringOccurrencesUseCase(repository);

        const first = await useCase.executeForAllUsers(now);
        const second = await useCase.executeForAllUsers(now);

        expect(first.generated).toBeGreaterThan(0);
        expect(second.generated).toBe(0);
        expect(repository.occurrences.size).toBe(first.generated);
        expect(repository.generatedAt.get("rule-1")).toEqual(now);
    });

    it("mantiene unicidad cuando dos ejecuciones se superponen", async () => {
        const repository = new InMemoryRecurringRuleRepository([recurringRule()]);
        const useCase = new GenerateRecurringOccurrencesUseCase(repository);

        const results = await Promise.all([
            useCase.executeForAllUsers(now),
            useCase.executeForAllUsers(now),
        ]);
        const reportedTotal = results.reduce((total, result) => total + result.generated, 0);

        expect(reportedTotal).toBe(repository.occurrences.size);
        expect(repository.occurrences.size).toBeGreaterThan(0);
        expect(new Set(repository.occurrences.keys()).size).toBe(repository.occurrences.size);
    });

    it("procesa solamente reglas activas", async () => {
        const repository = new InMemoryRecurringRuleRepository([
            recurringRule(),
            recurringRule({ id: "rule-2", isActive: false }),
        ]);
        const useCase = new GenerateRecurringOccurrencesUseCase(repository);

        const result = await useCase.executeForAllUsers(now);

        expect(result.processedRules).toBe(1);
        expect([...repository.occurrences.values()]).toEqual(
            expect.arrayContaining([expect.objectContaining({ ruleId: "rule-1" })]),
        );
        expect([...repository.occurrences.values()]).not.toEqual(
            expect.arrayContaining([expect.objectContaining({ ruleId: "rule-2" })]),
        );
    });
});
