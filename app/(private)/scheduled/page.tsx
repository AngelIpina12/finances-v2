import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ScheduledClient } from "@/src/features/scheduled/components/scheduled-client";
import { getScheduledOccurrenceData } from "@/src/features/scheduled/queries/get-scheduled-occurrence-data";
import { requireAuth } from "@/src/lib/auth-server";
import { generatePageTitle } from "@/src/shared/utils/metadata";

export const metadata: Metadata = {
    title: generatePageTitle("Programados"),
};

export default async function ScheduledPage() {
    const { session } = await requireAuth();

    if (!session) redirect("/auth/login");

    const data = await getScheduledOccurrenceData(session.user.id);

    return <ScheduledClient {...data} />;
}
