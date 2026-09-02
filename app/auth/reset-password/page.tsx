import { AuthForm } from "@/src/features/auth/components/AuthForm";
import { generatePageTitle } from "@/src/shared/utils/metadata";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: generatePageTitle("Reestablece tu contraseña")
}

export default async function ResetPasswordPage({
    searchParams,
}: {
    searchParams: Promise<{ token?: string | string[] }>;
}) {
    const tokenParam = (await searchParams).token;
    const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;

    return <AuthForm defaultMode="reset-password" resetToken={token} />
}
