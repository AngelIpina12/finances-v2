import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BudgetsClient } from "@/src/features/budgets/components/budgets-client";
import { getBudgets } from "@/src/features/budgets/queries/get-budgets";
import { requireAuth } from "@/src/lib/auth-server";
import { generatePageTitle } from "@/src/shared/utils/metadata";

export const metadata: Metadata = {
    title: generatePageTitle("Presupuestos"),
};

export default async function BudgetsPage() {
    const { session } = await requireAuth();

    if (!session) redirect("/auth/login");

    const data = await getBudgets(session.user.id);

    return <BudgetsClient {...data} />;
}
