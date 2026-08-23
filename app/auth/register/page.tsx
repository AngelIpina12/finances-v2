import { AuthForm } from "@/src/features/auth/components/AuthForm";
import { generatePageTitle } from "@/src/shared/utils/metadata";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: generatePageTitle("Empieza con claridad")
}

export default function RegisterPage() {
    return <AuthForm defaultMode="register" />
}
