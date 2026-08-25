import { auth } from "@/src/lib/auth";
import { generatePageTitle } from "@/src/shared/utils/metadata";
import { Metadata } from "next";
import { headers } from "next/headers";

export const metadata: Metadata = {
	title: generatePageTitle("Dashboard")
}

export default async function Home() {
	return (
		<>
			<h1>Dashboard</h1>
		</>
	);
}
