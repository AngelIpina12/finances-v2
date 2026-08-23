import { AuthForm } from '@/src/features/auth/components/AuthForm'
import { generatePageTitle } from '@/src/shared/utils/metadata'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: generatePageTitle("¿Olvidaste tu contraseña?")
}

export default function ForgotPasswordPage() {
    return <AuthForm defaultMode="forgot-password" />
}
