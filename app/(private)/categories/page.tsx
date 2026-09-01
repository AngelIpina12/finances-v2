import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CategoriesClient } from "@/src/features/categories/components/categories-client";
import { getCategories } from "@/src/features/categories/queries/get-categories";
import { requireAuth } from "@/src/lib/auth-server";
import { generatePageTitle } from "@/src/shared/utils/metadata";

export const metadata: Metadata = { title: generatePageTitle("Categorías") };

export default async function CategoriesPage() {
    const { session } = await requireAuth();
    if (!session) redirect("/auth/login");

    const categories = await getCategories(session.user.id);
    return <CategoriesClient categories={categories} />;
}
