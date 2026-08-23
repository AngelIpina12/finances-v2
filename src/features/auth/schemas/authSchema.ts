import z from "zod";

export const BaseAuthSchema = z.object({
    name: z.string().trim().min(1, "El nombre es obligatorio"),
    email: z.email("Por favor, introduce un correo electrónico válido"),
    resetEmail: z.email("Por favor, introduce un correo electrónico válido"),
    password: z.string().trim().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string().trim().min(1, "La contraseña de confirmación es obligatoria"),
});

export const SignUpSchema = BaseAuthSchema.pick({
    name: true,
    email: true,
    password: true,
    confirmPassword: true,
}).refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ['confirmPassword']
})

export const LoginSchema = BaseAuthSchema.pick({
    email: true,
    password: true,
});

export const ForgotPasswordSchema = BaseAuthSchema.pick({
    resetEmail: true,
});

export type AuthFormData = z.infer<typeof BaseAuthSchema>
export type SignUpFormData = z.infer<typeof SignUpSchema>
export type LoginFormData = z.infer<typeof LoginSchema>
export type ForgotPasswordFormData = z.infer<typeof ForgotPasswordSchema>