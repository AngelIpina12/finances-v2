import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import {
    financialAccounts, fixedIncomeCashFlows, fixedIncomePositions,
    transactions,
} from "@/src/db/schema";
import { toAppDateInputValue } from "@/src/shared/utils/local-date-time";
import { FixedIncomeError } from "../application/fixed-income-error";
import {
    calculateAccruedInterest, calculateDailyInterest, calculateNetInterest,
} from "../domain/fixed-income-calculator";
import type { FixedIncomePositionData } from "../schemas/fixed-income.schema";

const liquidAccountTypes = ["cash", "debit", "wallet"] as const;

function dateKey(date: Date) {
    return toAppDateInputValue(date);
}

function asNumber(value: string | number | null) {
    return Number(value ?? 0);
}

export class DrizzleFixedIncomeRepository {
    async withdraw(userId: string, positionId: string, amount: number, occurredAt: Date) {
        return db.transaction(async (tx) => {
            const [position] = await tx.select().from(fixedIncomePositions).where(and(
                eq(fixedIncomePositions.id, positionId),
                eq(fixedIncomePositions.userId, userId),
                eq(fixedIncomePositions.status, "active"),
            )).limit(1).for("update");
            if (!position || !position.isAvailableOnDemand) throw new FixedIncomeError("Sólo puedes retirar de una cajita activa y disponible al instante.");
            const available = asNumber(position.outstandingPrincipal);
            if (amount > available) throw new FixedIncomeError("El retiro no puede superar el saldo de la cajita.");
            const [funding] = await tx.select().from(financialAccounts).where(and(
                eq(financialAccounts.id, position.fundingAccountId),
                eq(financialAccounts.userId, userId),
                eq(financialAccounts.isActive, true),
                isNull(financialAccounts.deletedAt),
            )).limit(1).for("update");
            if (!funding) throw new FixedIncomeError("La cuenta de origen ya no está disponible.");
            const remaining = Math.round((available - amount) * 100) / 100;
            await tx.update(financialAccounts).set({ currentBalance: sql`${financialAccounts.currentBalance} + ${amount}` }).where(eq(financialAccounts.id, funding.id));
            await tx.update(fixedIncomePositions).set({
                outstandingPrincipal: String(remaining),
                status: remaining === 0 ? "settled" : "active",
            }).where(eq(fixedIncomePositions.id, position.id));
            await tx.insert(fixedIncomeCashFlows).values({
                positionId: position.id,
                type: "withdrawal",
                grossAmount: String(amount),
                netAmount: String(amount),
                occurredAt,
                idempotencyKey: `withdraw:${position.id}:${dateKey(occurredAt)}:${amount}`,
            });
        });
    }

    async create(userId: string, input: FixedIncomePositionData) {
        return db.transaction(async (tx) => {
            const accounts = await tx
                .select()
                .from(financialAccounts)
                .where(and(
                    eq(financialAccounts.userId, userId),
                    isNull(financialAccounts.deletedAt),
                    eq(financialAccounts.isActive, true),
                    inArray(financialAccounts.id, [
                        input.fundingAccountId,
                        input.settlementAccountId,
                    ]),
                ))
                .for("update");
            const funding = accounts.find((account) => account.id === input.fundingAccountId);
            const settlement = accounts.find((account) => account.id === input.settlementAccountId);

            if (
                !funding
                || !settlement
                || !liquidAccountTypes.includes(funding.type as typeof liquidAccountTypes[number])
                || !liquidAccountTypes.includes(settlement.type as typeof liquidAccountTypes[number])
            ) {
                throw new FixedIncomeError("El fondeo y la liquidación deben usar cuentas líquidas activas.");
            }

            if (funding.currency !== settlement.currency) {
                throw new FixedIncomeError("Las cuentas deben tener la misma moneda.");
            }

            const [allocated] = await tx
                .select({
                    total: sql<string>`coalesce(sum(${fixedIncomePositions.outstandingPrincipal}), 0)`,
                })
                .from(fixedIncomePositions)
                .where(and(
                    eq(fixedIncomePositions.userId, userId),
                    eq(fixedIncomePositions.fundingAccountId, funding.id),
                    eq(fixedIncomePositions.status, "active"),
                ));

            if (asNumber(funding.currentBalance) < asNumber(allocated.total) + input.principal) {
                throw new FixedIncomeError("La cuenta no tiene saldo libre suficiente para crear otra cajita.");
            }

            const [position] = await tx
                .insert(fixedIncomePositions)
                .values({
                    userId,
                    accountId: null,
                    fundingAccountId: funding.id,
                    settlementAccountId: settlement.id,
                    name: input.name,
                    institution: input.institution || null,
                    currency: funding.currency,
                    principal: String(input.principal),
                    outstandingPrincipal: String(input.principal),
                    annualRate: String(input.annualRate),
                    calculationMethod: input.calculationMethod,
                    dayCountConvention: input.dayCountConvention,
                    interestFrequency: input.interestFrequency,
                    withholdingRate: input.withholdingRate ? String(input.withholdingRate) : null,
                    startsAt: input.startsAt,
                    maturesAt: input.maturesAt,
                    isAvailableOnDemand: input.isAvailableOnDemand,
                    autoRenew: input.autoRenew,
                    status: "active",
                })
                .returning();
            await tx.insert(fixedIncomeCashFlows).values({
                positionId: position.id,
                type: "contribution",
                grossAmount: String(input.principal),
                netAmount: String(input.principal),
                occurredAt: input.startsAt,
                idempotencyKey: `contribution:${position.id}`,
            });
            await tx
                .update(financialAccounts)
                .set({ currentBalance: sql`${financialAccounts.currentBalance} - ${input.principal}` })
                .where(eq(financialAccounts.id, funding.id));

            return position.id;
        });
    }

    async recordDailyInterest(userId: string, positionId: string, occurredAt: Date) {
        return db.transaction(async (tx) => {
            const [position] = await tx
                .select()
                .from(fixedIncomePositions)
                .where(and(
                    eq(fixedIncomePositions.id, positionId),
                    eq(fixedIncomePositions.userId, userId),
                ))
                .limit(1)
                .for("update");
            if (!position) {
                throw new FixedIncomeError("No puedes modificar esta posición.");
            }

            if (position.status !== "active") {
                throw new FixedIncomeError("Sólo puedes registrar interés en una posición activa.");
            }

            if (occurredAt < position.startsAt || (position.maturesAt && occurredAt > position.maturesAt)) {
                throw new FixedIncomeError("La fecha debe estar dentro de la vigencia de la inversión.");
            }

            const key = `daily-interest:${dateKey(occurredAt)}`;
            const [existing] = await tx
                .select({ id: fixedIncomeCashFlows.id })
                .from(fixedIncomeCashFlows)
                .where(and(
                    eq(fixedIncomeCashFlows.positionId, position.id),
                    eq(fixedIncomeCashFlows.idempotencyKey, key),
                ))
                .limit(1);
            if (existing) {
                throw new FixedIncomeError("El rendimiento de ese día ya fue registrado.");
            }

            const gross = calculateDailyInterest(
                asNumber(position.outstandingPrincipal),
                asNumber(position.annualRate),
                position.dayCountConvention,
            );
            const { tax, net } = calculateNetInterest(gross, asNumber(position.withholdingRate));
            await tx
                .update(fixedIncomePositions)
                .set({ outstandingPrincipal: sql`${fixedIncomePositions.outstandingPrincipal} + ${net}` })
                .where(eq(fixedIncomePositions.id, position.id));
            await tx.insert(fixedIncomeCashFlows).values({
                positionId: position.id,
                type: "interest",
                grossAmount: String(gross),
                taxAmount: String(tax),
                netAmount: String(net),
                occurredAt,
                idempotencyKey: key,
            });

            return { gross, tax, net };
        });
    }

    async update(userId: string, positionId: string, input: FixedIncomePositionData) {
        return db.transaction(async (tx) => {
            const [position] = await tx.select().from(fixedIncomePositions).where(and(
                eq(fixedIncomePositions.id, positionId),
                eq(fixedIncomePositions.userId, userId),
            )).limit(1).for("update");
            if (!position) throw new FixedIncomeError("No puedes editar esta posición.");
            if (position.status !== "active") throw new FixedIncomeError("Sólo puedes editar una posición activa.");

            const [settlement] = await tx.select().from(financialAccounts).where(and(
                eq(financialAccounts.id, input.settlementAccountId),
                eq(financialAccounts.userId, userId),
                eq(financialAccounts.isActive, true),
                isNull(financialAccounts.deletedAt),
            )).limit(1).for("update");
            if (!settlement || !liquidAccountTypes.includes(settlement.type as typeof liquidAccountTypes[number])) throw new FixedIncomeError("La cuenta receptora debe ser una cuenta líquida activa.");
            if (settlement.currency !== position.currency) throw new FixedIncomeError("La cuenta receptora debe usar la misma moneda.");

            await tx.update(fixedIncomePositions).set({
                name: input.name,
                institution: input.institution || null,
                settlementAccountId: settlement.id,
                maturesAt: input.maturesAt,
                isAvailableOnDemand: input.isAvailableOnDemand,
            }).where(eq(fixedIncomePositions.id, position.id));
            if (position.accountId) await tx.update(financialAccounts).set({
                name: input.name,
                institution: input.institution || null,
                includeInLiquidity: input.isAvailableOnDemand,
            }).where(eq(financialAccounts.id, position.accountId));
        });
    }

    async cancel(userId: string, positionId: string, occurredAt: Date) {
        return db.transaction(async (tx) => {
            const [position] = await tx.select().from(fixedIncomePositions).where(and(eq(fixedIncomePositions.id, positionId), eq(fixedIncomePositions.userId, userId))).limit(1).for("update");
            if (!position) throw new FixedIncomeError("No puedes cancelar esta cajita.");
            if (position.status !== "active") throw new FixedIncomeError("Esta cajita ya no está activa.");
            const principal = asNumber(position.outstandingPrincipal);
            if (!position.accountId) {
                const [funding] = await tx.select().from(financialAccounts).where(and(
                    eq(financialAccounts.id, position.fundingAccountId),
                    eq(financialAccounts.userId, userId),
                    eq(financialAccounts.isActive, true),
                    isNull(financialAccounts.deletedAt),
                )).limit(1).for("update");
                if (!funding) throw new FixedIncomeError("La cuenta de origen ya no está disponible.");
                await tx.insert(fixedIncomeCashFlows).values({ positionId: position.id, type: "withdrawal", grossAmount: String(principal), netAmount: String(principal), occurredAt, idempotencyKey: `cancel:${position.id}` });
                await tx.update(financialAccounts).set({ currentBalance: sql`${financialAccounts.currentBalance} + ${principal}` }).where(eq(financialAccounts.id, funding.id));
                await tx.update(fixedIncomePositions).set({ status: "cancelled", outstandingPrincipal: "0" }).where(eq(fixedIncomePositions.id, position.id));
                return;
            }
            const [investment, settlement] = await Promise.all([
                tx.select().from(financialAccounts).where(and(eq(financialAccounts.id, position.accountId), eq(financialAccounts.userId, userId))).limit(1).for("update"),
                tx.select().from(financialAccounts).where(and(eq(financialAccounts.id, position.settlementAccountId), eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true), isNull(financialAccounts.deletedAt))).limit(1).for("update"),
            ]);
            const investmentAccount = investment[0];
            const settlementAccount = settlement[0];
            if (!investmentAccount || !settlementAccount) throw new FixedIncomeError("No fue posible encontrar las cuentas de la cajita.");
            const transferGroupId = crypto.randomUUID();
            await tx.insert(transactions).values([
                { userId, accountId: investmentAccount.id, transferGroupId, transferDirection: "out", type: "transfer", status: "completed", amount: String(principal), currency: position.currency, merchant: `Cancelación: ${position.name}`, date: occurredAt },
                { userId, accountId: settlementAccount.id, transferGroupId, transferDirection: "in", type: "transfer", status: "completed", amount: String(principal), currency: position.currency, merchant: `Cancelación: ${position.name}`, date: occurredAt },
            ]);
            await tx.update(financialAccounts).set({ currentBalance: sql`${financialAccounts.currentBalance} - ${principal}` }).where(eq(financialAccounts.id, investmentAccount.id));
            await tx.update(financialAccounts).set({ currentBalance: sql`${financialAccounts.currentBalance} + ${principal}` }).where(eq(financialAccounts.id, settlementAccount.id));
            await tx.insert(fixedIncomeCashFlows).values({ positionId: position.id, type: "withdrawal", grossAmount: String(principal), netAmount: String(principal), occurredAt, transferGroupId, idempotencyKey: `cancel:${position.id}` });
            await tx.update(fixedIncomePositions).set({ status: "cancelled", outstandingPrincipal: "0" }).where(eq(fixedIncomePositions.id, position.id));
        });
    }

    async settle(userId: string, positionId: string, occurredAt: Date) {
        return db.transaction(async (tx) => {
            const [position] = await tx.select().from(fixedIncomePositions).where(and(eq(fixedIncomePositions.id, positionId), eq(fixedIncomePositions.userId, userId))).limit(1).for("update");
            if (!position) throw new FixedIncomeError("No puedes liquidar esta posición.");
            if (position.status === "settled") throw new FixedIncomeError("Esta posición ya fue liquidada.");
            if (position.status !== "active" && position.status !== "matured") throw new FixedIncomeError("Esta posición no se puede liquidar.");
            if (occurredAt < position.startsAt) throw new FixedIncomeError("La fecha de liquidación no puede ser anterior al inicio.");
            const principal = asNumber(position.outstandingPrincipal);
            if (!position.accountId) {
                await tx.insert(fixedIncomeCashFlows).values({ positionId: position.id, type: "withdrawal", grossAmount: String(principal), netAmount: String(principal), occurredAt, idempotencyKey: `settle:${position.id}` });
                await tx.update(fixedIncomePositions).set({ status: "settled", outstandingPrincipal: "0" }).where(eq(fixedIncomePositions.id, position.id));
                return { principal, grossInterest: 0, netInterest: 0 };
            }
            const [investmentRows, settlementRows] = await Promise.all([
                tx.select().from(financialAccounts).where(and(eq(financialAccounts.id, position.accountId), eq(financialAccounts.userId, userId))).limit(1).for("update"),
                tx.select().from(financialAccounts).where(and(eq(financialAccounts.id, position.settlementAccountId), eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true), isNull(financialAccounts.deletedAt))).limit(1).for("update"),
            ]);
            const investment = investmentRows[0];
            const settlement = settlementRows[0];
            if (!investment || !settlement) throw new FixedIncomeError("No fue posible encontrar las cuentas de la posición.");
            const flows = await tx.select().from(fixedIncomeCashFlows).where(and(eq(fixedIncomeCashFlows.positionId, position.id), eq(fixedIncomeCashFlows.type, "interest")));
            const end = position.maturesAt && occurredAt > position.maturesAt ? position.maturesAt : occurredAt;
            const accrued = calculateAccruedInterest({ principal: asNumber(position.principal), annualRate: asNumber(position.annualRate), startsAt: position.startsAt, asOf: end, calculationMethod: position.calculationMethod, dayCountConvention: position.dayCountConvention }).gross;
            const paidGross = flows.reduce((total, flow) => total + asNumber(flow.grossAmount), 0);
            const remainingGross = Math.max(0, Math.round((accrued - paidGross) * 100) / 100);
            const { tax, net } = calculateNetInterest(remainingGross, asNumber(position.withholdingRate));
            const transferGroupId = crypto.randomUUID();
            await tx.insert(transactions).values([
                { userId, accountId: investment.id, transferGroupId, transferDirection: "out", type: "transfer", status: "completed", amount: String(principal), currency: position.currency, merchant: `Vencimiento: ${position.name}`, date: occurredAt },
                { userId, accountId: settlement.id, transferGroupId, transferDirection: "in", type: "transfer", status: "completed", amount: String(principal), currency: position.currency, merchant: `Vencimiento: ${position.name}`, date: occurredAt },
            ]);
            await tx.update(financialAccounts).set({ currentBalance: sql`${financialAccounts.currentBalance} - ${principal}` }).where(eq(financialAccounts.id, investment.id));
            await tx.update(financialAccounts).set({ currentBalance: sql`${financialAccounts.currentBalance} + ${principal}` }).where(eq(financialAccounts.id, settlement.id));
            await tx.insert(fixedIncomeCashFlows).values({ positionId: position.id, type: "maturity", grossAmount: String(principal), netAmount: String(principal), occurredAt, transferGroupId, idempotencyKey: `maturity:${position.id}` });
            if (net > 0) {
                const [interestTransaction] = await tx.insert(transactions).values({ userId, accountId: settlement.id, type: "income", status: "completed", amount: String(net), currency: position.currency, merchant: `Interés al vencimiento: ${position.name}`, date: occurredAt }).returning({ id: transactions.id });
                await tx.update(financialAccounts).set({ currentBalance: sql`${financialAccounts.currentBalance} + ${net}` }).where(eq(financialAccounts.id, settlement.id));
                await tx.insert(fixedIncomeCashFlows).values({ positionId: position.id, type: "interest", grossAmount: String(remainingGross), taxAmount: String(tax), netAmount: String(net), occurredAt, transactionId: interestTransaction.id, idempotencyKey: `settlement-interest:${position.id}` });
            }
            await tx.update(fixedIncomePositions).set({ status: "settled", outstandingPrincipal: "0" }).where(eq(fixedIncomePositions.id, position.id));
            return { principal, grossInterest: remainingGross, netInterest: net };
        });
    }
}
