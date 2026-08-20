import { AuthForm } from '@/src/shared/components/auth-form'
import { generatePageTitle } from '@/src/shared/utils/metadata'
import { Metadata } from 'next'

export const metadata: Metadata = {
    title: generatePageTitle("Home")
}

export default function LoginPage() {
    return <AuthForm defaultMode="login" />
}
