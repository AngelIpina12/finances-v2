import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FinancingClient } from "@/src/features/financing/components/financing-client";
import { getFinancingData } from "@/src/features/financing/queries/get-financing-data";
import { requireAuth } from "@/src/lib/auth-server";
import { generatePageTitle } from "@/src/shared/utils/metadata";

export const metadata: Metadata = {
    title: generatePageTitle("Financiamientos")
};

export default async function FinancingPage() {
    const { session } = await requireAuth();

    if (!session) redirect("/auth/login");

    const data = await getFinancingData(session.user.id);

    return <FinancingClient {...data} />;
}
