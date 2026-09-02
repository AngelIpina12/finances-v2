import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TransactionsClient } from "@/src/features/transactions/components/transactions-client";
import { getTransactionFormData, getTransactions } from "@/src/features/transactions/queries/get-transaction-data";
import { requireAuth } from "@/src/lib/auth-server";
import { generatePageTitle } from "@/src/shared/utils/metadata";

export const metadata: Metadata = { title: generatePageTitle("Movimientos") };

export default async function TransactionsPage() {
    const { session } = await requireAuth();

    if (!session) redirect("/auth/login");

    const [formData, transactions] = await Promise.all([
        getTransactionFormData(session.user.id),
        getTransactions(session.user.id),
    ]);

    return <TransactionsClient {...formData} transactions={transactions} />;
}
