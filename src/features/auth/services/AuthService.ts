import { auth } from "@/src/lib/auth";
import { LoginFormData, SignUpFormData } from "../schemas/authSchema";
import { authRepository, IAuthRepository } from './AuthRepository';
import { headers } from "next/headers";
import { APIError } from "better-auth";

class AuthService {
    constructor(
        private authRepository: IAuthRepository
    ) { }

    async register(credentials: SignUpFormData) {
        const { name, email, password } = credentials

        const user = await this.authRepository.userExists(email)
        if (user) {
            return {
                error: 'Este e-mail ya está registrado.',
                success: '',
            }
        }

        await auth.api.signUpEmail({
            body: {
                name,
                email,
                password,
                callbackURL: '/dashboard'
            },
            headers: await headers()
        });

        return {
            error: '',
            success: 'Cuenta creada exitosamente. Revise su correo electrónico para verificar su cuenta.',
        }
    }

    async login(credentials: LoginFormData) {
        const { email, password } = credentials

        const user = await this.authRepository.userExists(email)

        if (!user) {
            return {
                error: 'El usuario no existe.',
                success: '',
            }
        }

        try {
            await auth.api.signInEmail({
                body: {
                    email,
                    password,
                    callbackURL: '/dashboard'
                },
                headers: await headers()
            })
            return {
                error: '',
                success: 'Sesión iniciada correctamente'
            }
        } catch (error) {
            if (error instanceof APIError) {
                console.error(error.message)
                console.error(error.statusCode)

                const messages: Record<number, string> = {
                    401: 'Password Incorrecto',
                    403: 'Tu cuenta no ha sido confirmada, hemos enviado un email'
                }

                const errorMessage = messages[error.statusCode]

                if (error.message) {
                    return {
                        error: errorMessage,
                        success: ''
                    }
                }
            }
        }

        return {
            error: '',
            success: '',
        }
    }
}

export const authService = new AuthService(authRepository);