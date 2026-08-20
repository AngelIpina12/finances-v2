import type { Metadata } from "next";
import { Header } from "@/components/ui/Header";
import { generatePageTitle } from "@/src/shared/utils/metadata";

export const metadata: Metadata = {
    title: generatePageTitle("Welcome")
};

export default function RootLayout({ children }: LayoutProps<"/">) {
    return (
        <>
            <Header />
            {children}
        </>
    );
}
