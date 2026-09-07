import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ForecastClient } from "@/src/features/forecast/components/forecast-client";
import { getForecastData } from "@/src/features/forecast/queries/get-forecast-data";
import { requireAuth } from "@/src/lib/auth-server";
import { generatePageTitle } from "@/src/shared/utils/metadata";

export const metadata: Metadata = {
    title: generatePageTitle("Previsión"),
};

export default async function ForecastPage() {
    const { session } = await requireAuth();

    if (!session) redirect("/auth/login");

    const data = await getForecastData(session.user.id);

    return <ForecastClient {...data} />;
}
