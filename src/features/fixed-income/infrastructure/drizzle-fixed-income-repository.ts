import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/src/db";
import { financialAccounts, fixedIncomeCashFlows, fixedIncomePositions, transactions } from "@/src/db/schema";
import { calculateAccruedInterest, calculateDailyInterest, calculateNetInterest } from "../domain/fixed-income-calculator";
import { FixedIncomeError } from "../application/fixed-income-error";
import type { FixedIncomePositionData } from "../schemas/fixed-income.schema";

const liquidAccountTypes = ["cash", "debit", "wallet"] as const;

function dateKey(date: Date) {
    return date.toISOString().slice(0, 10);
}

function asNumber(value: string | number | null) {
    return Number(value ?? 0);
}

export class DrizzleFixedIncomeRepository {
    async create(userId: string, input: FixedIncomePositionData) {
        return db.transaction(async (tx) => {
            const accounts = await tx.select().from(financialAccounts).where(and(
                eq(financialAccounts.userId, userId),
                isNull(financialAccounts.deletedAt),
                eq(financialAccounts.isActive, true),
                inArray(financialAccounts.id, [input.fundingAccountId, input.settlementAccountId]),
            )).for("update");
            const funding = accounts.find((account) => account.id === input.fundingAccountId);
            const settlement = accounts.find((account) => account.id === input.settlementAccountId);
            if (!funding || !settlement || !liquidAccountTypes.includes(funding.type as typeof liquidAccountTypes[number]) || !liquidAccountTypes.includes(settlement.type as typeof liquidAccountTypes[number])) {
                throw new FixedIncomeError("El fondeo y la liquidación deben usar cuentas líquidas activas.");
            }
            if (funding.currency !== settlement.currency) throw new FixedIncomeError("Las cuentas deben tener la misma moneda.");
            if (asNumber(funding.currentBalance) < input.principal) throw new FixedIncomeError("La cuenta de fondeo no tiene saldo suficiente.");

            const [investmentAccount] = await tx.insert(financialAccounts).values({
                userId, name: input.name, type: "fixed_income", currency: funding.currency,
                openingBalance: "0", currentBalance: "0", institution: input.institution || null,
                includeInNetWorth: true, includeInLiquidity: input.isAvailableOnDemand,
            }).returning();
            const [position] = await tx.insert(fixedIncomePositions).values({
                userId, accountId: investmentAccount.id, fundingAccountId: funding.id, settlementAccountId: settlement.id,
                name: input.name, institution: input.institution || null, currency: funding.currency,
                principal: String(input.principal), outstandingPrincipal: String(input.principal),
                annualRate: String(input.annualRate), calculationMethod: input.calculationMethod,
                dayCountConvention: input.dayCountConvention, interestFrequency: input.interestFrequency,
                withholdingRate: input.withholdingRate ? String(input.withholdingRate) : null,
                startsAt: input.startsAt, maturesAt: input.maturesAt,
                isAvailableOnDemand: input.isAvailableOnDemand,
                autoRenew: input.autoRenew, status: "active",
            }).returning();
            const transferGroupId = crypto.randomUUID();
            await tx.insert(transactions).values([
                { userId, accountId: funding.id, transferGroupId, transferDirection: "out", type: "transfer", status: "completed", amount: String(input.principal), currency: funding.currency, merchant: input.name, date: input.startsAt },
                { userId, accountId: investmentAccount.id, transferGroupId, transferDirection: "in", type: "transfer", status: "completed", amount: String(input.principal), currency: funding.currency, merchant: input.name, date: input.startsAt },
            ]);
            await tx.update(financialAccounts).set({ currentBalance: sql`${financialAccounts.currentBalance} - ${input.principal}` }).where(eq(financialAccounts.id, funding.id));
            await tx.update(financialAccounts).set({ currentBalance: sql`${financialAccounts.currentBalance} + ${input.principal}` }).where(eq(financialAccounts.id, investmentAccount.id));
            await tx.insert(fixedIncomeCashFlows).values({ positionId: position.id, type: "contribution", grossAmount: String(input.principal), netAmount: String(input.principal), occurredAt: input.startsAt, transferGroupId, idempotencyKey: `contribution:${transferGroupId}` });
            return position.id;
        });
    }

    async recordDailyInterest(userId: string, positionId: string, occurredAt: Date) {
        return db.transaction(async (tx) => {
            const [position] = await tx.select().from(fixedIncomePositions).where(and(eq(fixedIncomePositions.id, positionId), eq(fixedIncomePositions.userId, userId))).limit(1).for("update");
            if (!position) throw new FixedIncomeError("No puedes modificar esta posición.");
            if (position.status !== "active") throw new FixedIncomeError("Sólo puedes registrar interés en una posición activa.");
            if (occurredAt < position.startsAt || (position.maturesAt && occurredAt > position.maturesAt)) throw new FixedIncomeError("La fecha debe estar dentro de la vigencia de la inversión.");
            const key = `daily-interest:${dateKey(occurredAt)}`;
            const [existing] = await tx.select({ id: fixedIncomeCashFlows.id }).from(fixedIncomeCashFlows).where(and(eq(fixedIncomeCashFlows.positionId, position.id), eq(fixedIncomeCashFlows.idempotencyKey, key))).limit(1);
            if (existing) throw new FixedIncomeError("El rendimiento de ese día ya fue registrado.");
            const [settlement] = await tx.select().from(financialAccounts).where(and(eq(financialAccounts.id, position.settlementAccountId), eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true), isNull(financialAccounts.deletedAt))).limit(1).for("update");
            if (!settlement) throw new FixedIncomeError("La cuenta de liquidación ya no está disponible.");
            const gross = calculateDailyInterest(asNumber(position.outstandingPrincipal), asNumber(position.annualRate), position.dayCountConvention);
            const { tax, net } = calculateNetInterest(gross, asNumber(position.withholdingRate));
            const [interestTransaction] = await tx.insert(transactions).values({ userId, accountId: settlement.id, type: "income", status: "completed", amount: String(net), currency: position.currency, merchant: `Rendimiento: ${position.name}`, date: occurredAt }).returning({ id: transactions.id });
            await tx.update(financialAccounts).set({ currentBalance: sql`${financialAccounts.currentBalance} + ${net}` }).where(eq(financialAccounts.id, settlement.id));
            await tx.insert(fixedIncomeCashFlows).values({ positionId: position.id, type: "interest", grossAmount: String(gross), taxAmount: String(tax), netAmount: String(net), occurredAt, transactionId: interestTransaction.id, idempotencyKey: key });
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
            if (!settlement || !liquidAccountTypes.includes(settlement.type as typeof liquidAccountTypes[number])) {
                throw new FixedIncomeError("La cuenta receptora debe ser una cuenta líquida activa.");
            }
            if (settlement.currency !== position.currency) {
                throw new FixedIncomeError("La cuenta receptora debe usar la misma moneda.");
            }

            await tx.update(fixedIncomePositions).set({
                name: input.name,
                institution: input.institution || null,
                settlementAccountId: settlement.id,
                maturesAt: input.maturesAt,
                isAvailableOnDemand: input.isAvailableOnDemand,
            }).where(eq(fixedIncomePositions.id, position.id));
            await tx.update(financialAccounts).set({
                name: input.name,
                institution: input.institution || null,
                includeInLiquidity: input.isAvailableOnDemand,
            }).where(eq(financialAccounts.id, position.accountId));
        });
    }

    async cancel(userId: string, positionId: string, occurredAt: Date) {
        return db.transaction(async (tx) => {
            const [position] = await tx.select().from(fixedIncomePositions).where(and(
                eq(fixedIncomePositions.id, positionId),
                eq(fixedIncomePositions.userId, userId),
            )).limit(1).for("update");
            if (!position) throw new FixedIncomeError("No puedes cancelar esta cajita.");
            if (position.status !== "active") throw new FixedIncomeError("Esta cajita ya no está activa.");

            const [investment, settlement] = await Promise.all([
                tx.select().from(financialAccounts).where(and(
                    eq(financialAccounts.id, position.accountId),
                    eq(financialAccounts.userId, userId),
                )).limit(1).for("update"),
                tx.select().from(financialAccounts).where(and(
                    eq(financialAccounts.id, position.settlementAccountId),
                    eq(financialAccounts.userId, userId),
                    eq(financialAccounts.isActive, true),
                    isNull(financialAccounts.deletedAt),
                )).limit(1).for("update"),
            ]);
            const investmentAccount = investment[0];
            const settlementAccount = settlement[0];
            if (!investmentAccount || !settlementAccount) throw new FixedIncomeError("No fue posible encontrar las cuentas de la cajita.");

            const principal = asNumber(position.outstandingPrincipal);
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
            const [investmentRows, settlementRows] = await Promise.all([
                tx.select().from(financialAccounts).where(and(eq(financialAccounts.id, position.accountId), eq(financialAccounts.userId, userId))).limit(1).for("update"),
                tx.select().from(financialAccounts).where(and(eq(financialAccounts.id, position.settlementAccountId), eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true), isNull(financialAccounts.deletedAt))).limit(1).for("update"),
            ]);
            const investment = investmentRows[0];
            const settlement = settlementRows[0];
            if (!investment || !settlement) throw new FixedIncomeError("No fue posible encontrar las cuentas de la posición.");
            const flows = await tx.select().from(fixedIncomeCashFlows).where(and(eq(fixedIncomeCashFlows.positionId, position.id), eq(fixedIncomeCashFlows.type, "interest")));
            const end = position.maturesAt && occurredAt > position.maturesAt
                ? position.maturesAt
                : occurredAt;
            const accrued = calculateAccruedInterest({ principal: asNumber(position.principal), annualRate: asNumber(position.annualRate), startsAt: position.startsAt, asOf: end, calculationMethod: position.calculationMethod, dayCountConvention: position.dayCountConvention }).gross;
            const paidGross = flows.reduce((total, flow) => total + asNumber(flow.grossAmount), 0);
            const remainingGross = Math.max(0, Math.round((accrued - paidGross) * 100) / 100);
            const { tax, net } = calculateNetInterest(remainingGross, asNumber(position.withholdingRate));
            const principal = asNumber(position.outstandingPrincipal);
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
