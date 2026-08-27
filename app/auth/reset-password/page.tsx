import { AuthForm } from "@/src/features/auth/components/AuthForm";
import { generatePageTitle } from "@/src/shared/utils/metadata";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: generatePageTitle("Reestablece tu contraseña")
}

export default function ResetPasswordPage() {
    return <AuthForm defaultMode="reset-password" />
}
