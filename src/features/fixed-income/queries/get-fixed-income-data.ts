import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import { financialAccounts, fixedIncomeCashFlows, fixedIncomePositions } from "@/src/db/schema";
import {
    calculateAccruedInterest, calculateDailyInterest,
    calculateNetInterest,
} from "../domain/fixed-income-calculator";

export async function getFixedIncomeData(userId: string) {
    const [accounts, positions] = await Promise.all([
        db.select({ id: financialAccounts.id, name: financialAccounts.name, currency: financialAccounts.currency, type: financialAccounts.type, currentBalance: financialAccounts.currentBalance })
            .from(financialAccounts)
            .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isActive, true), isNull(financialAccounts.deletedAt)))
            .orderBy(asc(financialAccounts.name)),
        db.select({ position: fixedIncomePositions, accountName: financialAccounts.name })
            .from(fixedIncomePositions)
            .innerJoin(financialAccounts, eq(fixedIncomePositions.accountId, financialAccounts.id))
            .where(eq(fixedIncomePositions.userId, userId))
            .orderBy(asc(fixedIncomePositions.maturesAt)),
    ]);
    const ids = positions.map(({ position }) => position.id);
    const flows = ids.length
        ? await db.select().from(fixedIncomeCashFlows).where(and(eq(fixedIncomeCashFlows.type, "interest"), inArray(fixedIncomeCashFlows.positionId, ids)))
        : [];
    const now = new Date();
    const portfolio = positions.map(({ position, accountName }) => {
        const accrued = calculateAccruedInterest({
            principal: Number(position.principal), annualRate: Number(position.annualRate), startsAt: position.startsAt,
            asOf: position.maturesAt && now > position.maturesAt ? position.maturesAt : now,
            calculationMethod: position.calculationMethod, dayCountConvention: position.dayCountConvention,
        }).gross;
        const paidGross = flows.filter((flow) => flow.positionId === position.id).reduce((total, flow) => total + Number(flow.grossAmount), 0);
        const estimatedGross = Math.max(0, Math.round((accrued - paidGross) * 100) / 100);
        const { tax: estimatedTax, net: estimatedNet } = calculateNetInterest(estimatedGross, Number(position.withholdingRate ?? 0));
        const estimatedDailyNet = calculateNetInterest(
            calculateDailyInterest(
                Number(position.outstandingPrincipal),
                Number(position.annualRate),
                position.dayCountConvention,
            ),
            Number(position.withholdingRate ?? 0),
        ).net;
        return {
            ...position, accountName, principal: Number(position.principal), outstandingPrincipal: Number(position.outstandingPrincipal), annualRate: Number(position.annualRate), withholdingRate: Number(position.withholdingRate ?? 0),
            estimatedGross, estimatedTax, estimatedNet, estimatedDailyNet,
            estimatedValue: Number(position.outstandingPrincipal) + estimatedNet,
        };
    });
    return {
        liquidAccounts: accounts.filter((account) => ["cash", "debit", "wallet"].includes(account.type)).map((account) => ({ ...account, currentBalance: Number(account.currentBalance) })),
        positions: portfolio,
    };
}

export type FixedIncomeData = Awaited<ReturnType<typeof getFixedIncomeData>>;
