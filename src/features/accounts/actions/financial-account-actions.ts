"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/src/lib/auth-server";
import { financialAccountSchema, FinancialAccountFormData } from "../schemas/financial-account.schema";
import { ArchiveAccountUseCase } from "../application/use-cases/archive-account";
import { CreateAccountUseCase } from "../application/use-cases/create-account";
import { UpdateAccountUseCase } from "../application/use-cases/update-account";
import { DrizzleAccountRepository } from "../infrastructure/drizzle-account-repository";

const accounts = new DrizzleAccountRepository();
const createAccount = new CreateAccountUseCase(accounts);
const updateAccount = new UpdateAccountUseCase(accounts);
const archiveAccount = new ArchiveAccountUseCase(accounts);

export async function saveFinancialAccount(input: FinancialAccountFormData) {
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

    try {
        if (data.id) {
            const updated = await updateAccount.execute(
                session.user.id,
                data.id,
                data,
            );

            if (!updated) {
                return { success: false, message: "No encontramos esa cuenta." };
            }
        } else {
            await createAccount.execute(session.user.id, data);
        }
    } catch {
        return {
            success: false,
            message: "No fue posible guardar la cuenta. Inténtalo de nuevo.",
        };
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

    const archived = await archiveAccount.execute(session.user.id, accountId);

    if (!archived)
        return { success: false, message: "No encontramos esa cuenta." };

    revalidatePath("/accounts");
    revalidatePath("/dashboard");

    return { success: true, message: "Cuenta archivada." };
}
