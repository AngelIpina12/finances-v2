import { describe, expect, it } from "vitest";
import type {
    ForecastAccount, ProjectedForecastEvent,
} from "./forecast-calculator";
import { buildLiquidityRangeSummaries } from "./liquidity-calculator";

const account: ForecastAccount = {
    id: "debit",
    name: "Débito",
    type: "debit",
    currency: "MXN",
    currentBalance: 1000,
    creditLimit: null,
    billingDate: null,
    statementBalance: null,
    minimumPayment: null,
    includeInLiquidity: true,
};

function event(
    id: string,
    scheduledAt: string,
    amount: number,
    transactionType: "income" | "expense",
    source: ProjectedForecastEvent["source"] = "scheduled",
): ProjectedForecastEvent {
    return {
        id,
        accountId: account.id,
        source,
        name: id,
        amount,
        currency: "MXN",
        scheduledAt: new Date(scheduledAt),
        transactionType,
        affectsBalance: true,
        balanceAfter: null,
        settledBalanceAfter: null,
        liquidityAfter: null,
    };
}

describe("buildLiquidityRangeSummaries", () => {
    it("calcula el saldo inicial con eventos previos y separa las salidas del rango", () => {
        const [summary] = buildLiquidityRangeSummaries({
            accounts: [account],
            startsAt: new Date("2026-09-07T06:00:00.000Z"),
            endsAt: new Date("2026-09-12T06:00:00.000Z"),
            events: [
                event("previous-income", "2026-09-06T18:00:00.000Z", 500, "income"),
                event("income", "2026-09-08T18:00:00.000Z", 100, "income"),
                event("direct", "2026-09-09T18:00:00.000Z", 300, "expense"),
                event("card", "2026-09-10T18:00:00.000Z", 400, "expense", "card_payment"),
                event("financing", "2026-09-11T18:00:00.000Z", 200, "expense", "financing"),
            ],
        });

        expect(summary).toEqual(expect.objectContaining({
            today: 1000,
            starting: 1500,
            incomes: 100,
            directExpenses: 300,
            cardPayments: 400,
            financingPayments: 200,
            minimum: 700,
            ending: 700,
            firstNegativeAt: null,
        }));
    });

    it("identifica el primer momento con liquidez consolidada negativa", () => {
        const [summary] = buildLiquidityRangeSummaries({
            accounts: [account],
            startsAt: new Date("2026-09-07T06:00:00.000Z"),
            endsAt: new Date("2026-09-12T06:00:00.000Z"),
            events: [event("expense", "2026-09-09T18:00:00.000Z", 1200, "expense")],
        });

        expect(summary?.firstNegativeAt).toEqual(new Date("2026-09-09T18:00:00.000Z"));
        expect(summary?.ending).toBe(-200);
    });

    it("mantiene monedas separadas y usa un rango con inicio inclusivo y fin exclusivo", () => {
        const usdAccount = { ...account, id: "usd", currency: "USD" as const, currentBalance: 500 };
        const [mxnSummary, usdSummary] = buildLiquidityRangeSummaries({
            accounts: [account, usdAccount],
            startsAt: new Date("2026-09-07T06:00:00.000Z"),
            endsAt: new Date("2026-09-08T06:00:00.000Z"),
            events: [
                event("at-start", "2026-09-07T06:00:00.000Z", 100, "income"),
                event("at-end", "2026-09-08T06:00:00.000Z", 900, "expense"),
                {
                    ...event("usd-income", "2026-09-07T18:00:00.000Z", 50, "income"),
                    accountId: usdAccount.id,
                    currency: "USD",
                },
            ],
        });

        expect(mxnSummary).toEqual(expect.objectContaining({ currency: "MXN", ending: 1100 }));
        expect(usdSummary).toEqual(expect.objectContaining({ currency: "USD", ending: 550 }));
    });
});
