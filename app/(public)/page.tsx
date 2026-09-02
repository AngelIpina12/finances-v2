import { generatePageTitle } from "@/src/shared/utils/metadata";
import { Metadata } from "next";

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
