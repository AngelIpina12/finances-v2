import {
    afterEach, describe, expect,
    it
} from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
    creditCardPaymentSettings, financialAccounts, recurringRules,
    scheduledOccurrences, transactions, users,
} from "@/src/db/schema";
import { getForecastData } from "./get-forecast-data";

const userIds: string[] = [];

afterEach(async () => {
    await Promise.all(userIds.splice(0).map((id) => (
        db.delete(users).where(eq(users.id, id))
    )));
});

describe("getForecastData integration", () => {
    it("combina los programados con las recurrencias que aún no se han materializado", async () => {
        const userId = crypto.randomUUID();
        userIds.push(userId);
        await db.insert(users).values({
            id: userId,
            name: "Forecast Test",
            email: `${userId}@example.test`,
        });
        const [account] = await db.insert(financialAccounts).values({
            userId,
            name: "Cuenta test",
            type: "debit",
            currency: "MXN",
            currentBalance: "1000",
        }).returning({ id: financialAccounts.id });
        await db.insert(scheduledOccurrences).values({
            userId,
            accountId: account.id,
            transactionType: "expense",
            name: "Renta programada",
            amount: "300",
            currency: "MXN",
            originalScheduledAt: new Date("2026-09-06T18:00:00.000Z"),
            scheduledAt: new Date("2026-09-06T18:00:00.000Z"),
        });
        await db.insert(recurringRules).values({
            userId,
            accountId: account.id,
            transactionType: "income",
            frequency: "weekly",
            name: "Ingreso recurrente",
            amount: "500",
            currency: "MXN",
            startsAt: new Date("2026-09-07T18:00:00.000Z"),
        });

        const result = await getForecastData(userId, new Date("2026-09-05T12:00:00.000Z"));

        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: "Renta programada", source: "scheduled" }),
            expect.objectContaining({ name: "Ingreso recurrente", source: "recurring" }),
        ]));
    });

    it("incluye la configuración de pago de una tarjeta en los datos de previsión", async () => {
        const userId = crypto.randomUUID();
        userIds.push(userId);
        await db.insert(users).values({
            id: userId,
            name: "Card settings test",
            email: `${userId}@example.test`,
        });
        const [sourceAccount] = await db.insert(financialAccounts).values({
            userId,
            name: "Débito test",
            type: "debit",
            currency: "MXN",
            currentBalance: "5000",
            includeInLiquidity: true,
        }).returning({ id: financialAccounts.id });
        const [creditAccount] = await db.insert(financialAccounts).values({
            userId,
            name: "Tarjeta test",
            type: "credit",
            currency: "MXN",
            currentBalance: "1200",
            billingDate: 24,
            statementBalance: "1000",
            minimumPayment: "100",
            includeInLiquidity: false,
        }).returning({ id: financialAccounts.id });
        await db.insert(creditCardPaymentSettings).values({
            userId,
            creditAccountId: creditAccount.id,
            sourceAccountId: sourceAccount.id,
            strategy: "full_statement",
            paymentTermDays: 20,
            includeInForecast: true,
        });
        await db.insert(transactions).values([
            {
                userId,
                accountId: creditAccount.id,
                type: "expense",
                status: "completed",
                amount: "250",
                currency: "MXN",
                merchant: "Cargo del ciclo actual",
                date: new Date("2026-09-01T18:00:00.000Z"),
            },
            {
                userId,
                accountId: creditAccount.id,
                type: "expense",
                status: "completed",
                amount: "100",
                currency: "MXN",
                merchant: "Cargo ya incluido en el corte",
                date: new Date("2026-08-24T18:00:00.000Z"),
            },
        ]);

        const result = await getForecastData(userId, new Date("2026-09-05T12:00:00.000Z"));

        expect(result.cardPaymentSettings).toEqual([expect.objectContaining({
            creditAccountId: creditAccount.id,
            sourceAccountId: sourceAccount.id,
            paymentTermDays: 20,
        })]);
        expect(result.accounts).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: creditAccount.id, billingDate: 24, statementBalance: 1000 }),
        ]));
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({
                source: "posted_card_charge",
                accountId: creditAccount.id,
                amount: 250,
                name: "Cargo del ciclo actual",
            }),
        ]));
        expect(result.events.find((event) => event.name === "Cargo ya incluido en el corte")).toBeUndefined();
    });

    it("aísla usuarios y excluye estados atendidos y cuentas archivadas", async () => {
        const userId = crypto.randomUUID();
        const otherUserId = crypto.randomUUID();
        userIds.push(userId, otherUserId);
        await db.insert(users).values([
            { id: userId, name: "Forecast owner", email: `${userId}@example.test` },
            { id: otherUserId, name: "Other owner", email: `${otherUserId}@example.test` },
        ]);
        const [activeAccount] = await db.insert(financialAccounts).values({
            userId,
            name: "Cuenta activa",
            type: "debit",
            currency: "MXN",
            currentBalance: "1000",
        }).returning({ id: financialAccounts.id });
        const [archivedAccount] = await db.insert(financialAccounts).values({
            userId,
            name: "Cuenta archivada",
            type: "debit",
            currency: "MXN",
            currentBalance: "1000",
            isActive: false,
            deletedAt: new Date("2026-09-01T12:00:00.000Z"),
        }).returning({ id: financialAccounts.id });
        const [otherAccount] = await db.insert(financialAccounts).values({
            userId: otherUserId,
            name: "Cuenta de otro usuario",
            type: "debit",
            currency: "MXN",
            currentBalance: "1000",
        }).returning({ id: financialAccounts.id });
        const scheduledAt = new Date("2026-09-08T18:00:00.000Z");
        await db.insert(scheduledOccurrences).values([
            { userId, accountId: activeAccount.id, transactionType: "expense", name: "Visible", amount: "100", currency: "MXN", originalScheduledAt: scheduledAt, scheduledAt },
            { userId, accountId: activeAccount.id, transactionType: "expense", status: "completed", name: "Completada", amount: "100", currency: "MXN", originalScheduledAt: scheduledAt, scheduledAt },
            { userId, accountId: activeAccount.id, transactionType: "expense", status: "cancelled", name: "Cancelada", amount: "100", currency: "MXN", originalScheduledAt: scheduledAt, scheduledAt },
            { userId, accountId: archivedAccount.id, transactionType: "expense", name: "Archivada", amount: "100", currency: "MXN", originalScheduledAt: scheduledAt, scheduledAt },
            { userId: otherUserId, accountId: otherAccount.id, transactionType: "expense", name: "Otro usuario", amount: "100", currency: "MXN", originalScheduledAt: scheduledAt, scheduledAt },
        ]);
        const [rule] = await db.insert(recurringRules).values({
            userId,
            accountId: activeAccount.id,
            transactionType: "income",
            frequency: "weekly",
            name: "Nómina",
            amount: "500",
            currency: "MXN",
            startsAt: scheduledAt,
        }).returning({ id: recurringRules.id });
        await db.insert(scheduledOccurrences).values({
            userId,
            source: "recurring_rule",
            recurringRuleId: rule.id,
            sequence: 1,
            accountId: activeAccount.id,
            transactionType: "income",
            status: "completed",
            name: "Nómina materializada",
            amount: "500",
            currency: "MXN",
            originalScheduledAt: scheduledAt,
            scheduledAt,
        });

        const result = await getForecastData(userId, new Date("2026-09-07T12:00:00.000Z"));

        expect(result.accounts.map((account) => account.id)).toEqual([activeAccount.id]);
        expect(result.events).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: "Visible" }),
            expect.objectContaining({ source: "recurring", name: "Nómina" }),
        ]));
        expect(result.events.map((event) => event.name)).not.toEqual(expect.arrayContaining([
            "Completada", "Cancelada", "Archivada", "Otro usuario", "Nómina materializada",
        ]));
        expect(result.events.some((event) => event.id === `recurring:${rule.id}:1`)).toBe(false);
    });
});
