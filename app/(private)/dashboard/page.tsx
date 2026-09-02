import type { Metadata } from "next";
import { Dashboard } from "@/src/features/dashboard/components/dashboard";
import { getDashboardData } from "@/src/features/dashboard/queries/get-dashboard-data";
import { requireAuth } from "@/src/lib/auth-server";
import { generatePageTitle } from "@/src/shared/utils/metadata";

export const metadata: Metadata = {
    title: generatePageTitle("Dashboard"),
};

export default async function DashboardPage() {
    const { session } = await requireAuth();

    if (!session) return null;

    const data = await getDashboardData(session.user.id);

    return <Dashboard data={data} userName={session.user.name} />;
}
