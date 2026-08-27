"use server"

import { ForgotPasswordFormData, ForgotPasswordSchema, LoginFormData, LoginSchema, ResetPasswordFormData, ResetPasswordSchema, SignUpFormData, SignUpSchema } from "../schemas/authSchema"
import { authService } from "../services/AuthService"

export async function signUpAction(input: SignUpFormData) {
    const data = SignUpSchema.safeParse(input)

    if (!data.success) {
        return {
            error: 'Hubo un error',
            success: ''
        }
    }

    return await authService.register(data.data)
}

export async function signInAction(input: LoginFormData) {
    const data = LoginSchema.safeParse(input)

    if (!data.success) {
        return {
            error: 'Hubo un error',
            success: ''
        }
    }

    return await authService.login(data.data)
}

export async function forgotPasswordAction(input: ForgotPasswordFormData) {
    const data = ForgotPasswordSchema.safeParse(input)

    if (!data.success) {
        return {
            error: 'Hubo un error',
            success: ''
        }
    }

    return await authService.requestPasswordReset(data.data)
    
}

export async function resetPasswordAction(input: ResetPasswordFormData, token: string | null) {
    const data = ResetPasswordSchema.safeParse(input)

    if (!data.success || !token) {
        return {
            error: token ? 'Hubo un error' : 'El enlace para restablecer la contraseña no es válido o expiró.',
            success: ''
        }
    }

    return authService.resetPassword(data.data, token)
}
