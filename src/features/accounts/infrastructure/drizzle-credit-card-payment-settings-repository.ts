import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import {
    creditCardPaymentSettings, financialAccounts,
} from "@/src/db/schema";
import type {
    CreditCardPaymentSettingsRepository, CreditCardPaymentSettingsScope,
} from "../domain/credit-card-payment-settings-repository";

class DrizzleCreditCardPaymentSettingsScope implements CreditCardPaymentSettingsScope {
    constructor(private readonly tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) { }

    async findAccount(userId: string, accountId: string) {
        const [account] = await this.tx
            .select({
                id: financialAccounts.id,
                type: financialAccounts.type,
                currency: financialAccounts.currency,
                includeInLiquidity: financialAccounts.includeInLiquidity,
            })
            .from(financialAccounts)
            .where(and(
                eq(financialAccounts.id, accountId),
                eq(financialAccounts.userId, userId),
                eq(financialAccounts.isActive, true),
                isNull(financialAccounts.deletedAt),
            ))
            .limit(1)
            .for("update");

        return account as Awaited<ReturnType<CreditCardPaymentSettingsScope["findAccount"]>>;
    }

    async save(userId: string, input: Parameters<CreditCardPaymentSettingsScope["save"]>[1]) {
        await this.tx
            .insert(creditCardPaymentSettings)
            .values({
                userId,
                creditAccountId: input.creditAccountId,
                sourceAccountId: input.sourceAccountId,
                strategy: input.strategy,
                fixedAmount: input.fixedAmount === undefined ? null : String(input.fixedAmount),
                paymentTermDays: input.paymentTermDays,
                includeInForecast: input.includeInForecast,
            })
            .onConflictDoUpdate({
                target: creditCardPaymentSettings.creditAccountId,
                set: {
                    sourceAccountId: input.sourceAccountId,
                    strategy: input.strategy,
                    fixedAmount: input.fixedAmount === undefined ? null : String(input.fixedAmount),
                    paymentTermDays: input.paymentTermDays,
                    includeInForecast: input.includeInForecast,
                },
            });

        await this.tx
            .update(financialAccounts)
            .set({
                billingDate: input.billingDate,
                statementBalance: input.statementBalance === undefined ? null : String(input.statementBalance),
                minimumPayment: input.minimumPayment === undefined ? null : String(input.minimumPayment),
            })
            .where(and(
                eq(financialAccounts.id, input.creditAccountId),
                eq(financialAccounts.userId, userId),
            ));
    }
}

export class DrizzleCreditCardPaymentSettingsRepository
    implements CreditCardPaymentSettingsRepository {
    async withinTransaction<T>(work: (scope: CreditCardPaymentSettingsScope) => Promise<T>) {
        return db.transaction((tx) => work(new DrizzleCreditCardPaymentSettingsScope(tx)));
    }
}
