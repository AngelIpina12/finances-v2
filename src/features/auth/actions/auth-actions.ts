"use server"

import { LoginFormData, LoginSchema, SignUpFormData, SignUpSchema } from "../schemas/authSchema"
import { authService } from "../services/AuthService"

export async function signUpAction(input: SignUpFormData) {
    const data = SignUpSchema.safeParse(input)

    if (!data.success) {
        return {
            error: 'Hubo un error',
            success: ''
        }
    }

    const response = await authService.register(data.data)
    return response
}

export async function signInAction(input: LoginFormData) {
    const data = LoginSchema.safeParse(input)

    if (!data.success) {
        return {
            error: 'Hubo un error',
            success: ''
        }
    }

    const response = await authService.login(data.data)
    return response
}