import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FixedIncomeClient } from "@/src/features/fixed-income/components/fixed-income-client";
import { getFixedIncomeData } from "@/src/features/fixed-income/queries/get-fixed-income-data";
import { requireAuth } from "@/src/lib/auth-server";
import { generatePageTitle } from "@/src/shared/utils/metadata";

export const metadata: Metadata = { title: generatePageTitle("Renta fija") };

export default async function FixedIncomePage() {
    const { session } = await requireAuth();
    if (!session) redirect("/auth/login");
    return <FixedIncomeClient {...await getFixedIncomeData(session.user.id)} />;
}
