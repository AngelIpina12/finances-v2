import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoanSimulationsClient } from "@/src/features/loan-simulations/components/loan-simulations-client";
import { getLoanSimulationsData } from "@/src/features/loan-simulations/queries/get-loan-simulations-data";
import { requireAuth } from "@/src/lib/auth-server";
import { generatePageTitle } from "@/src/shared/utils/metadata";

export const metadata: Metadata = { title: generatePageTitle("Simulador de créditos") };

export default async function LoanSimulatorPage() {
    const { session } = await requireAuth();
    if (!session) redirect("/auth/login");
    return <LoanSimulationsClient {...await getLoanSimulationsData(session.user.id)} />;
}
