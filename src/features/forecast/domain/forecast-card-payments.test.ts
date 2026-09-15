import { describe, expect, it } from "vitest";
import {
    buildForecast, type CardPaymentSetting,
    type ForecastAccount, type ForecastEvent,
} from "./forecast-calculator";
import { buildLiquidityRangeSummaries } from "./liquidity-calculator";

const now = new Date("2026-09-10T12:00:00.000Z");

function accounts(statementBalance: number | null = 800): ForecastAccount[] {
    return [
        {
            id: "debit", name: "Débito", type: "debit", currency: "MXN",
            currentBalance: 10000, creditLimit: null, billingDate: null,
            statementBalance: null, minimumPayment: null, includeInLiquidity: true,
        },
        {
            id: "credit", name: "Tarjeta", type: "credit", currency: "MXN",
            currentBalance: 4000, creditLimit: 10000, billingDate: 24,
            statementBalance, minimumPayment: 100, includeInLiquidity: false,
        },
    ];
}

function setting(
    strategy: CardPaymentSetting["strategy"],
    fixedAmount: number | null = null,
): CardPaymentSetting {
    return {
        creditAccountId: "credit",
        sourceAccountId: "debit",
        strategy,
        fixedAmount,
        paymentTermDays: 20,
        includeInForecast: true,
    };
}

const futureCharge: ForecastEvent = {
    id: "charge",
    accountId: "credit",
    source: "scheduled",
    name: "Compra prevista",
    amount: 3200,
    currency: "MXN",
    scheduledAt: new Date("2026-09-20T18:00:00.000Z"),
    transactionType: "expense",
    affectsBalance: true,
};

describe("credit card payment forecast", () => {
    it.each([
        { strategy: "full_statement" as const, fixedAmount: null, expected: [800, 3200] },
        { strategy: "minimum_payment" as const, fixedAmount: null, expected: [100, 100] },
        { strategy: "fixed_amount" as const, fixedAmount: 500, expected: [500, 500] },
        { strategy: "fixed_amount" as const, fixedAmount: 5000, expected: [800, 3200] },
    ])("aplica la estrategia $strategy sin pagar más que el compromiso", ({
        strategy, fixedAmount, expected,
    }) => {
        const result = buildForecast({
            accounts: accounts(),
            events: [futureCharge],
            settings: [setting(strategy, fixedAmount)],
            now,
            days: 60,
        });

        expect(result.events
            .filter((event) => event.source === "card_payment")
            .map((event) => event.amount))
            .toEqual(expected);
    });

    it("marca como vencido un estado cuyo día límite ya pasó", () => {
        const overdueNow = new Date("2026-09-20T18:00:00.000Z");
        const result = buildForecast({
            accounts: accounts(800),
            events: [],
            settings: [setting("full_statement")],
            now: overdueNow,
            days: 30,
        });

        expect(result.events).toEqual([expect.objectContaining({
            source: "card_payment",
            scheduledAt: overdueNow,
            amount: 800,
            isOverdue: true,
        })]);
        expect(result.alerts).toEqual([expect.objectContaining({
            accountId: "credit",
            kind: "overdue_payment",
            amount: 800,
        })]);
    });

    it("omite sólo el pago de tarjeta descartado para ese vencimiento", () => {
        const result = buildForecast({
            accounts: accounts(800),
            events: [],
            settings: [setting("full_statement")],
            dismissedCardPaymentKeys: ["credit:2026-09-13T06:00:00.000Z"],
            now,
            days: 30,
        });

        expect(result.events.filter((event) => event.source === "card_payment")).toEqual([]);
    });

    it("incluye un cargo ya registrado después del corte en el vencimiento de su ciclo", () => {
        const postedCharge: ForecastEvent = {
            id: "posted-charge",
            accountId: "credit",
            source: "posted_card_charge",
            name: "Compra ya realizada",
            amount: 1200,
            currency: "MXN",
            scheduledAt: new Date("2026-09-01T18:00:00.000Z"),
            transactionType: "expense",
            affectsBalance: false,
        };
        const result = buildForecast({
            accounts: accounts(),
            events: [postedCharge],
            settings: [setting("full_statement")],
            now,
            days: 60,
        });

        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: "card_payment", amount: 800 }),
            expect.objectContaining({
                source: "card_payment",
                amount: 1200,
                scheduledAt: new Date("2026-10-14T06:00:00.000Z"),
            }),
        ]));
        expect(result.events.find((event) => event.source === "posted_card_charge")).toBeUndefined();
    });

    it("mantiene separadas las cuotas MSI del pago informado para no generar intereses", () => {
        const installment: ForecastEvent = {
            id: "installment",
            accountId: "credit",
            source: "financing",
            name: "Cuota MSI",
            amount: 1000,
            currency: "MXN",
            scheduledAt: new Date("2026-09-12T18:00:00.000Z"),
            transactionType: "expense",
            affectsBalance: false,
        };
        const result = buildForecast({
            accounts: accounts(3000),
            events: [installment],
            settings: [setting("full_statement")],
            now,
            days: 30,
        });
        const statementPayment = result.events.find((event) => event.source === "card_payment");

        expect(statementPayment).toEqual(expect.objectContaining({ amount: 3000 }));
        expect(statementPayment?.cardPaymentBreakdown).toEqual(expect.objectContaining({
            statementBalance: 3000,
            trackedInstallments: 1000,
            untrackedStatement: 3000,
        }));
        expect(result.accounts).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: "debit", projectedBalance: 7000 }),
            expect.objectContaining({ id: "credit", projectedBalance: 1000 }),
        ]));
    });

    it("proyecta varias tarjetas desde la misma cuenta líquida", () => {
        const sharedAccounts: ForecastAccount[] = [
            accounts()[0]!,
            { ...accounts(500)[1]!, id: "credit-a", currentBalance: 500 },
            { ...accounts(500)[1]!, id: "credit-b", currentBalance: 500 },
        ];
        const result = buildForecast({
            accounts: sharedAccounts,
            events: [],
            settings: [
                { ...setting("full_statement"), creditAccountId: "credit-a" },
                { ...setting("full_statement"), creditAccountId: "credit-b" },
            ],
            now,
            days: 30,
        });

        expect(result.events.filter((event) => event.source === "card_payment")).toHaveLength(2);
        expect(result.accounts).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: "debit", projectedBalance: 9000 }),
            expect.objectContaining({ id: "credit-a", projectedBalance: 0 }),
            expect.objectContaining({ id: "credit-b", projectedBalance: 0 }),
        ]));
    });

    it("cumple un escenario con ingresos, recibos, tarjetas y una cuota financiada", () => {
        const scenarioAccounts: ForecastAccount[] = [
            { ...accounts(null)[0]!, currentBalance: 5000 },
            { ...accounts(null)[0]!, id: "cash", name: "Efectivo", type: "cash", currentBalance: 1000 },
            { ...accounts(null)[1]!, id: "card-a", currentBalance: 1000 },
            { ...accounts(null)[1]!, id: "card-b", currentBalance: 600 },
        ];
        const scenarioEvents: ForecastEvent[] = [
            { id: "payroll", accountId: "debit", source: "recurring", name: "Nómina", amount: 4000, currency: "MXN", scheduledAt: new Date("2026-09-10T18:00:00.000Z"), transactionType: "income", affectsBalance: true },
            { id: "monthly-income", accountId: "debit", source: "recurring", name: "Ingreso mensual", amount: 2000, currency: "MXN", scheduledAt: new Date("2026-09-15T18:00:00.000Z"), transactionType: "income", affectsBalance: true },
            { id: "receipt", accountId: "debit", source: "scheduled", name: "Recibo", amount: 1000, currency: "MXN", scheduledAt: new Date("2026-09-12T18:00:00.000Z"), transactionType: "expense", affectsBalance: true },
            { ...futureCharge, id: "groceries", accountId: "card-a", name: "Mandado" },
            { ...futureCharge, id: "subscription", accountId: "card-b", name: "Suscripción", amount: 300, scheduledAt: new Date("2026-09-21T18:00:00.000Z") },
            { id: "msi", accountId: "card-b", source: "financing", name: "Cuota MSI", amount: 500, currency: "MXN", scheduledAt: new Date("2026-09-25T18:00:00.000Z"), transactionType: "expense", affectsBalance: false },
        ];
        const result = buildForecast({
            accounts: scenarioAccounts,
            events: scenarioEvents,
            settings: [
                { ...setting("full_statement"), creditAccountId: "card-a" },
                { ...setting("full_statement"), creditAccountId: "card-b" },
            ],
            now,
            days: 60,
        });
        const [summary] = buildLiquidityRangeSummaries({
            accounts: scenarioAccounts,
            events: result.events,
            startsAt: now,
            endsAt: new Date("2026-11-09T12:00:00.000Z"),
            currency: "MXN",
        });

        expect(summary).toEqual(expect.objectContaining({
            today: 6000,
            incomes: 6000,
            directExpenses: 1000,
            financingPayments: 0,
        }));
        expect(result.accounts).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: "card-a", projectedBalance: 1000 }),
            expect.objectContaining({ id: "card-b", projectedBalance: 100 }),
        ]));
    });
});
