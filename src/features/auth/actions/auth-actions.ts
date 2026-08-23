"use server"

import { SignUpFormData, SignUpSchema } from "../schemas/authSchema"
import { authService } from "../services/AuthService"

export async function signUpAction(input: SignUpFormData) {
    const data = SignUpSchema.safeParse(input)

    if (!data.success) {
        return {
            error: 'Hubo un error',
            success: ''
        }
    }

    await authService.register(data.data)
}