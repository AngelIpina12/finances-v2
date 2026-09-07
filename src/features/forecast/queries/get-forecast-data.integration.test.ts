import {
    afterEach, describe, expect,
    it
} from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/src/db";
import {
    financialAccounts, recurringRules, scheduledOccurrences,
    users,
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
});
