import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountsClient } from "@/src/features/accounts/components/accounts-client";
import { getFinancialAccounts } from "@/src/features/accounts/queries/get-financial-accounts";
import { getCreditAccountsStatementData } from "@/src/features/accounts/queries/get-credit-accounts-statement-data";
import { requireAuth } from "@/src/lib/auth-server";
import { generatePageTitle } from "@/src/shared/utils/metadata";

export const metadata: Metadata = { title: generatePageTitle("Mis cuentas") };

export default async function AccountsPage() {
    const { session } = await requireAuth();

    if (!session) redirect("/auth/login");

    const accounts = await getFinancialAccounts(session.user.id);
    const creditAccounts = accounts.filter((account) => account.type === "credit" && account.isActive);
    const statementByAccountId = await getCreditAccountsStatementData(session.user.id, creditAccounts);

    return <AccountsClient accounts={accounts} statementByAccountId={statementByAccountId} />;
}
