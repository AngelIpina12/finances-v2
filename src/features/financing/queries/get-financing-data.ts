import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/src/db";
import {
    financialAccounts, financingInstallments, financingPlans,
    transactions,
} from "@/src/db/schema";

export async function getFinancingData(userId: string) {
    const [purchases, accounts, plans, installments] = await Promise.all([
        db
            .select({
                id: transactions.id,
                name: transactions.merchant,
                amount: transactions.amount,
                currency: transactions.currency,
                date: transactions.date,
                accountName: financialAccounts.name,
            })
            .from(transactions)
            .innerJoin(financialAccounts, eq(transactions.accountId, financialAccounts.id))
            .where(and(
                eq(transactions.userId, userId),
                eq(transactions.type, "expense"),
                eq(transactions.status, "completed"),
                eq(financialAccounts.type, "credit"),
                isNull(transactions.financingPlanId),
            ))
            .orderBy(desc(transactions.date))
            .limit(100),
        db
            .select({
                id: financialAccounts.id,
                name: financialAccounts.name,
                type: financialAccounts.type,
                currency: financialAccounts.currency,
            })
            .from(financialAccounts)
            .where(and(
                eq(financialAccounts.userId, userId),
                eq(financialAccounts.isActive, true),
                isNull(financialAccounts.deletedAt),
            ))
            .orderBy(asc(financialAccounts.name)),
        db
            .select({
                id: financingPlans.id,
                name: financingPlans.name,
                totalAmount: financingPlans.totalAmount,
                regularInstallmentCount: financingPlans.regularInstallmentCount,
                regularInstallmentAmount: financingPlans.regularInstallmentAmount,
                balloonAmount: financingPlans.balloonAmount,
                currency: financingPlans.currency,
                startsAt: financingPlans.startsAt,
                status: financingPlans.status,
                creditAccountName: financialAccounts.name,
                purchaseName: transactions.merchant,
                purchaseDate: transactions.date,
            })
            .from(financingPlans)
            .innerJoin(financialAccounts, eq(financingPlans.creditAccountId, financialAccounts.id))
            .innerJoin(transactions, eq(financingPlans.purchaseTransactionId, transactions.id))
            .where(eq(financingPlans.userId, userId))
            .orderBy(desc(financingPlans.createdAt)),
        db
            .select({
                id: financingInstallments.id,
                financingPlanId: financingInstallments.financingPlanId,
                sequence: financingInstallments.sequence,
                scheduledAt: financingInstallments.scheduledAt,
                amount: financingInstallments.amount,
                isBalloon: financingInstallments.isBalloon,
                paidAt: financingInstallments.paidAt,
            })
            .from(financingInstallments)
            .innerJoin(financingPlans, eq(financingInstallments.financingPlanId, financingPlans.id))
            .where(eq(financingPlans.userId, userId))
            .orderBy(asc(financingInstallments.sequence)),
    ]);

    return {
        purchases: purchases.map((purchase) => ({ ...purchase, amount: Number(purchase.amount) })),
        paymentAccounts: accounts.filter((account) => account.type !== "credit"),
        plans: plans.map((plan) => ({
            ...plan,
            totalAmount: Number(plan.totalAmount),
            regularInstallmentAmount: Number(plan.regularInstallmentAmount),
            balloonAmount: Number(plan.balloonAmount),
            installments: installments
                .filter((installment) => installment.financingPlanId === plan.id)
                .map((installment) => ({ ...installment, amount: Number(installment.amount) })),
        })),
    };
}

export type FinancingData = Awaited<ReturnType<typeof getFinancingData>>;
