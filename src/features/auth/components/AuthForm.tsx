'use client'

import { useState } from 'react'
import {
	redirect, useRouter, useSearchParams
} from 'next/navigation'
import {
	ArrowRight, BarChart3, Check,
	Eye, EyeOff, LockKeyhole,
	Mail, ShieldCheck, TrendingUp,
	Sun, Moon
} from 'lucide-react'
import Link from 'next/link'
import { Resolver, useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { zodResolver } from '@hookform/resolvers/zod'
import {
	CardContent, CardDescription, CardHeader,
	CardTitle
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Form, FormLabel, FormInput,
	FormSubmit, SegmentedControl, FormError
} from '@/components/forms'
import { useTheme } from '../../../components/providers/theme-provider'
import {
	ForgotPasswordSchema, LoginSchema, SignUpSchema,
	AuthFormData, LoginFormData, SignUpFormData,
	ForgotPasswordFormData, ResetPasswordFormData, ResetPasswordSchema
} from '../schemas/authSchema'
import {
	forgotPasswordAction, resetPasswordAction, signInAction,
	signUpAction
} from '../actions/auth-actions'

type Mode = 'login' | 'register' | 'forgot-password' | 'reset-password'

interface AuthFormProps {
	defaultMode?: Mode
}

export function AuthForm({ defaultMode = 'login' }: AuthFormProps) {
	const [mode, setMode] = useState<Mode>(defaultMode)
	const [showPassword, setShowPassword] = useState(false)
	const [submitted, setSubmitted] = useState(false)
	const { theme, setTheme } = useTheme()
	const router = useRouter()
	const searchParams = useSearchParams()
	const isRegister = mode === 'register'
	const isResetPassword = mode === 'reset-password'
	const schema = mode === 'forgot-password'
		? ForgotPasswordSchema
		: isResetPassword
			? ResetPasswordSchema
			: mode === 'register'
				? SignUpSchema
				: LoginSchema

	const { register, handleSubmit, formState: { errors }, reset } = useForm<AuthFormData>({
		resolver: zodResolver(schema) as unknown as Resolver<AuthFormData>,
		mode: 'all'
	})

	const handleLogin = async (data: LoginFormData) => {
		console.log('Login:', data)
		const { error, success } = await signInAction(data)

		if (error) {
			toast.error(error)
		}
		if (success) {
			toast.success(success)
			reset()
			redirect('/dashboard')
		}
	}

	const handleRegister = async (data: SignUpFormData) => {
		console.log('Register:', data)
		const { error, success } = await signUpAction(data)

		if (error) {
			toast.error(error)
		}
		if (success) {
			toast.success(success)
			reset()
		}
	}

	const handleForgotPassword = async (data: ForgotPasswordFormData) => {
		const { error, success } = await forgotPasswordAction(data)

		if (error) {
			toast.error(error)
		}
		if (success) {
			toast.success(success)
		}
	}

	const handleResetPassword = async (data: ResetPasswordFormData) => {
		const token = searchParams.get('token')
		if (!token) redirect('/auth/forgot-password')

		const { error, success } = await resetPasswordAction(data, token)

		if (error) {
			toast.error(error)
		}
		if (success) {
			toast.success(success)
			reset()
			router.push('/auth/login')
		}
	}

	const onSubmit = async (data: AuthFormData) => {
		setSubmitted(true)

		switch (mode) {
			case 'login':
				return handleLogin(data)
			case 'register':
				return await handleRegister(data)
			case 'forgot-password':
				return handleForgotPassword(data)
			case 'reset-password':
				return handleResetPassword(data)
		}
	}


	function handleModeChange(nextMode: Mode) {
		setMode(nextMode)
		setSubmitted(false)
		setShowPassword(false)
		if (nextMode === 'login') {
			router.push('/auth/login')
		} else if (nextMode === 'register') {
			router.push('/auth/register')
		}
	}

	return (
		<main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6 lg:px-8">
			<div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-2xl shadow-primary/10">
				<section className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex xl:p-12">
					<div className="relative z-10 flex items-center gap-3">
						<span className="grid size-10 place-items-center rounded-xl bg-primary-foreground/12 ring-1 ring-primary-foreground/20">
							<BarChart3 className="size-5" aria-hidden="true" />
						</span>
						<span className="font-sans text-lg font-semibold tracking-tight">Finances</span>
					</div>

					<div className="relative z-10 flex flex-col gap-10">
						<div className="flex flex-col gap-5">
							<p className="flex items-center gap-2 text-sm font-medium text-primary-foreground/65">
								Claridad para tus decisiones
							</p>
							<h1 className="max-w-md font-serif text-5xl leading-[1.05] tracking-[-0.04em] xl:text-6xl">
								Tu dinero,<br />
								<span className="text-accent">en perspectiva.</span>
							</h1>
							<p className="max-w-sm text-sm leading-6 text-primary-foreground/65">
								Una forma más tranquila de entender tus finanzas, construir hábitos y avanzar hacia lo que realmente importa.
							</p>
						</div>

						<div className="rounded-2xl border border-primary-foreground/15 bg-primary-foreground/8 p-5 backdrop-blur-sm">
							<div className="mb-7 flex items-start justify-between">
								<div className="flex flex-col gap-1">
									<span className="text-xs text-primary-foreground/55">Balance total</span>
									<strong className="font-sans text-2xl font-semibold tracking-tight">€24.860,40</strong>
								</div>
								<span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">+12,8%</span>
							</div>
							<div className="flex h-16 items-end gap-1.5" aria-label="Tendencia ascendente del balance">
								{[28, 38, 30, 48, 42, 57, 51, 72, 63, 82, 76, 100].map((height, index) => (
									<span
										key={index}
										className="flex-1 rounded-t-sm bg-accent/75"
										style={{ height: `${height}%` }}
									/>
								))}
							</div>
							<div className="mt-3 flex items-center gap-2 text-xs text-primary-foreground/55">
								<TrendingUp className="size-3.5 text-accent" aria-hidden="true" />
								<span>Tu patrimonio crece de forma constante</span>
							</div>
						</div>
					</div>

					<div className="relative z-10 flex items-center gap-2 text-xs text-primary-foreground/45">
						<ShieldCheck className="size-4" aria-hidden="true" />
						Tus datos están protegidos y siempre bajo tu control
					</div>
					<div className="pointer-events-none absolute -bottom-40 -right-32 size-96 rounded-full border border-primary-foreground/10" />
					<div className="pointer-events-none absolute -bottom-28 -right-20 size-64 rounded-full border border-primary-foreground/10" />
				</section>

				<section className="flex flex-1 flex-col bg-background px-5 py-8 sm:px-12 sm:py-12 lg:px-14 xl:px-20">
					<div className="mb-10 flex items-center justify-between lg:justify-end">
						<button
							onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
							className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
							aria-label="Cambiar tema"
						>
							{theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
						</button>
						<div className="flex items-center gap-2 lg:hidden">
							<span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
								<BarChart3 className="size-4" aria-hidden="true" />
							</span>
							<span className="font-sans font-semibold tracking-tight">Finances</span>
						</div>
						<p className="text-sm text-muted-foreground">
							{mode === 'forgot-password' || isResetPassword ? (
								<>
									¿Recordaste tu contraseña?{' '}
									<Link
										href="/auth/login"
										className="font-medium text-accent-foreground hover:underline"
									>
										Inicia sesión
									</Link>
								</>
							) : isRegister ? (
								<>
									¿Ya tienes una cuenta?{' '}
									<Link
										href="/auth/login"
										className="font-medium text-accent-foreground hover:underline"
									>
										Inicia sesión
									</Link>
								</>
							) : (
								<>
									¿Nuevo en Finances?{' '}
									<Link
										href="/auth/register"
										className="font-medium text-accent-foreground hover:underline"
									>
										Crea tu cuenta
									</Link>
								</>
							)}
						</p>
					</div>

					<div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">

						<CardHeader className="gap-3 px-0">
							<p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground">
								{mode === 'forgot-password' ? 'Recupera tu cuenta' : isResetPassword ? 'Nueva contraseña' : 'Bienvenido a Finances'}
							</p>
							<CardTitle
								className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl"
							>
								{mode === 'forgot-password'
									? '¿Olvidaste tu contraseña?'
									: isResetPassword
										? 'Crea una nueva contraseña.'
										: isRegister
											? 'Empieza con claridad.'
											: 'Qué bueno verte.'}
							</CardTitle>
							<CardDescription
								className="text-sm leading-6"
							>
								{mode === 'forgot-password'
									? 'No te preocupes, te enviaremos las instrucciones para restablecerla.'
									: isResetPassword
										? 'Elige una contraseña segura para volver a acceder a tu espacio.'
										: isRegister
											? 'Crea tu espacio financiero privado en menos de un minuto.'
											: 'Entra para retomar el control de tus finanzas.'}
							</CardDescription>
						</CardHeader>

						<CardContent className="px-0 pt-8">
							{mode === 'forgot-password' ? (
								<Form onSubmit={handleSubmit(onSubmit)}>
									<div className="flex flex-col gap-2">
										<FormLabel htmlFor="reset-email">Correo electrónico</FormLabel>
										<div className="relative">
											<Mail
												className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
												aria-hidden="true"
											/>
											<FormInput
												id="reset-email"
												type="email"
												placeholder="tu@email.com"
												className="pl-11"
												{...register('resetEmail')}
											/>
										</div>
										{errors.resetEmail && <FormError>{errors.resetEmail.message}</FormError>}
									</div>
									<FormSubmit className="h-12 rounded-xl">
										{submitted
											? <>
												<Check data-icon="inline-start" />
												Instrucciones enviadas
											</> : <>
												Enviar instrucciones
												<ArrowRight data-icon="inline-end" />
											</>
										}
									</FormSubmit>
									<p className="mt-4 text-center">
										<Link
											href="/auth/login"
											className="text-xs font-medium text-accent-foreground hover:underline"
										>
											Volver a iniciar sesión
										</Link>
									</p>
								</Form>
							) : isResetPassword ? (
								<Form onSubmit={handleSubmit(onSubmit)}>
									<div className="flex flex-col gap-2">
										<FormLabel htmlFor="new-password">Nueva contraseña</FormLabel>
										<div className="relative">
											<LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
											<FormInput id="new-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" className="pl-11" {...register('password')} />
											<button
												type="button"
												onClick={() => setShowPassword(!showPassword)}
												className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
												aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
											>
												{showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
											</button>
										</div>
										{errors.password && <FormError>{errors.password.message}</FormError>}
									</div>
									<div className="flex flex-col gap-2">
										<FormLabel htmlFor="confirm-password">Confirmar contraseña</FormLabel>
										<FormInput id="confirm-password" type="password" placeholder="Repite tu nueva contraseña" {...register('confirmPassword')} />
										{errors.confirmPassword && <FormError>{errors.confirmPassword.message}</FormError>}
									</div>
									<FormSubmit className="h-12 rounded-xl">
										{submitted ? <><Check data-icon="inline-start" />Contraseña restablecida</> : <>Restablecer contraseña<ArrowRight data-icon="inline-end" /></>}
									</FormSubmit>
								</Form>
							) : (
								<>
									<SegmentedControl
										items={['login', 'register'] as const}
										labels={{ login: 'Iniciar sesión', register: 'Crear cuenta' }}
										value={mode}
										onChange={handleModeChange}
									/>

									<Form onSubmit={handleSubmit(onSubmit)}>
										{isRegister && (
											<div className="flex flex-col gap-2">
												<FormLabel htmlFor="name">Nombre completo</FormLabel>
												<FormInput
													id="name"
													placeholder="Ana García"
													{...register('name')}
												/>
												{errors.name && <FormError>{errors.name.message}</FormError>}
											</div>
										)}
										<div className="flex flex-col gap-2">
											<FormLabel htmlFor="email">Correo electrónico</FormLabel>
											<div className="relative">
												<Mail
													className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
													aria-hidden="true"
												/>
												<FormInput
													id="email"
													type="email"
													placeholder="tu@email.com"
													className="pl-11"
													{...register('email')}
												/>
											</div>
											{errors.email && <FormError>{errors.email.message}</FormError>}
										</div>
										<div className="flex flex-col gap-2">
											<div className="flex items-center justify-between">
												<FormLabel htmlFor="password">Contraseña</FormLabel>
												{!isRegister && (
													<Link
														href="/auth/forgot-password"
														className="text-xs font-medium text-accent-foreground hover:underline"
													>
														¿La olvidaste?
													</Link>
												)}
											</div>
											<div className="relative">
												<LockKeyhole
													className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
													aria-hidden="true"
												/>
												<FormInput
													id="password"
													type={showPassword ? 'text' : 'password'}
													placeholder="••••••••"
													className="pl-11"
													{...register('password')}
												/>
												<button
													type="button"
													onClick={() => setShowPassword(!showPassword)}
													className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
													aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
												>
													{showPassword
														? <EyeOff className="size-4" aria-hidden="true" />
														: <Eye className="size-4" aria-hidden="true" />
													}
												</button>
											</div>
											{errors.password && <FormError>{errors.password.message}</FormError>}
										</div>
										{isRegister && (
											<div className="flex flex-col gap-2">
												<FormLabel htmlFor="confirm-password">Confirmar contraseña</FormLabel>
												<FormInput
													id="confirm-password"
													type="password"
													placeholder="Repite tu contraseña"
													{...register('confirmPassword')}
												/>
												{errors.confirmPassword && <FormError>{errors.confirmPassword.message}</FormError>}
											</div>
										)}
										{!isRegister
											&& <div className="flex items-center gap-2">
												<Checkbox id="remember" className="cursor-pointer" />
												<FormLabel
													htmlFor="remember"
													className="text-sm font-normal text-muted-foreground"
												>
													Recordar sesión
												</FormLabel>
											</div>
										}
										<FormSubmit className="h-12 rounded-xl">
											{submitted
												? <>
													<Check data-icon="inline-start" />
													{isRegister
														? 'Cuenta creada'
														: 'Sesión iniciada'
													}
												</> : <>
													{isRegister
														? 'Crear mi cuenta'
														: 'Entrar a mi espacio'
													}
													<ArrowRight data-icon="inline-end" />
												</>
											}
										</FormSubmit>
									</Form>
									<p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
										Al continuar, aceptas nuestros&nbsp;
										<button
											type="button"
											className="underline underline-offset-2 hover:text-foreground cursor-pointer"
										>
											términos de uso
										</button>
										&nbsp;y&nbsp;
										<button
											type="button"
											className="underline underline-offset-2 hover:text-foreground cursor-pointer"
										>
											política de privacidad
										</button>
										.
									</p>
								</>
							)}
						</CardContent>
					</div>
					<p className="mt-8 text-center text-xs text-muted-foreground">
						© 2026 Finances Finance · Diseñado para vivir con más calma
					</p>
				</section>
			</div>
		</main>
	)
}
