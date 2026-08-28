"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/src/db";
import { financialAccounts } from "@/src/db/schema";
import { requireAuth } from "@/src/lib/auth-server";
import {
  financialAccountSchema,
  type FinancialAccountInput,
} from "../schemas/financial-account.schema";

export async function saveFinancialAccount(input: FinancialAccountInput) {
  const parsed = financialAccountSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const { session } = await requireAuth();

  if (!session) {
    return {
      success: false,
      message: "Tu sesión expiró. Inicia sesión de nuevo.",
    };
  }

  const data = parsed.data;
  const isCreditAccount = data.type === "credit";
  const owedAmount = isCreditAccount ? (data.owedAmount ?? 0) : null;
  const creditLimit = isCreditAccount ? (data.creditLimit ?? 0) : null;
  const currentBalance = isCreditAccount ? owedAmount : data.openingBalance;
  const availableCredit = isCreditAccount
    ? Math.max(0, (creditLimit ?? 0) - (owedAmount ?? 0))
    : null;
  const values = {
    name: data.name,
    type: data.type,
    currency: data.currency,
    institution: data.institution || null,
    openingBalance: String(isCreditAccount ? 0 : data.openingBalance),
    // Until transaction CRUD exists, the editable opening balance is also the balance.
    // Once transactions exist, this must be derived from the transaction ledger instead.
    currentBalance: String(currentBalance),
    color: data.color,
    lastFourDigits: data.lastFourDigits || null,
    includeInNetWorth: data.includeInNetWorth,
    creditLimit: creditLimit === null ? null : String(creditLimit),
    owedAmount: owedAmount === null ? null : String(owedAmount),
    availableCredit: availableCredit === null ? null : String(availableCredit),
    billingDate: isCreditAccount ? (data.billingDate ?? null) : null,
    dueDate: isCreditAccount ? (data.dueDate ?? null) : null,
  };

  if (data.id) {
    const [account] = await db
      .update(financialAccounts)
      .set(values)
      .where(
        and(
          eq(financialAccounts.id, data.id),
          eq(financialAccounts.userId, session.user.id),
          isNull(financialAccounts.deletedAt),
        ),
      )
      .returning({ id: financialAccounts.id });

    if (!account)
      return { success: false, message: "No encontramos esa cuenta." };
  } else {
    await db
      .insert(financialAccounts)
      .values({ ...values, userId: session.user.id });
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");

  return {
    success: true,
    message: data.id ? "Cuenta actualizada." : "Cuenta creada.",
  };
}

export async function archiveFinancialAccount(accountId: string) {
  const { session } = await requireAuth();

  if (!session) return { success: false, message: "Tu sesión expiró." };

  const [account] = await db
    .update(financialAccounts)
    .set({ isActive: false, deletedAt: new Date() })
    .where(
      and(
        eq(financialAccounts.id, accountId),
        eq(financialAccounts.userId, session.user.id),
        isNull(financialAccounts.deletedAt),
      ),
    )
    .returning({ id: financialAccounts.id });

  if (!account)
    return { success: false, message: "No encontramos esa cuenta." };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");

  return { success: true, message: "Cuenta archivada." };
}
