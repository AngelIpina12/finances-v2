'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import {
  ArrowRight, BarChart3, Check,
  Eye, EyeOff, LockKeyhole,
  Mail, ShieldCheck, TrendingUp,
  Sun, Moon
} from 'lucide-react'
import { Button } from '@/src/shared/components/ui/button'
import {
  CardContent, CardDescription,
  CardHeader, CardTitle
} from '@/src/shared/components/ui/card'
import { Checkbox } from '@/src/shared/components/ui/checkbox'
import { Input } from '@/src/shared/components/ui/input'
import { Label } from '@/src/shared/components/ui/label'

type Mode = 'login' | 'register'

interface AuthFormProps {
  defaultMode?: Mode
}

export function AuthForm({ defaultMode = 'login' }: AuthFormProps) {
  const [mode, setMode] = useState<Mode>(defaultMode)
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const { theme, setTheme } = useTheme()

  const isRegister = mode === 'register'

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)
  }

  function changeMode(nextMode: Mode) {
    setMode(nextMode)
    setSubmitted(false)
    setShowPassword(false)
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
                  <span key={index} className="flex-1 rounded-t-sm bg-accent/75" style={{ height: `${height}%` }} />
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
              className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
              {isRegister ? '¿Ya tienes una cuenta?' : '¿Nuevo en Finances?'}{' '}
              <button type="button" onClick={() => changeMode(isRegister ? 'login' : 'register')} className="font-medium text-accent-foreground underline-offset-4 hover:underline">
                {isRegister ? 'Inicia sesión' : 'Crea tu cuenta'}
              </button>
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">

            <CardHeader className="gap-3 px-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground">Bienvenido a Finances</p>
              <CardTitle className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">{isRegister ? 'Empieza con claridad.' : 'Qué bueno verte.'}</CardTitle>
              <CardDescription className="text-sm leading-6">{isRegister ? 'Crea tu espacio financiero privado en menos de un minuto.' : 'Entra para retomar el control de tus finanzas.'}</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pt-8">
              <div className="mb-6 flex rounded-xl bg-muted p-1">
                {(['login', 'register'] as const).map((item) => (
                  <button key={item} type="button" onClick={() => changeMode(item)} className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${mode === item ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`} aria-pressed={mode === item}>
                    {item === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                  </button>
                ))}
              </div>

              <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
                {isRegister && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="name">Nombre completo</Label>
                    <Input id="name" name="name" placeholder="Ana García" autoComplete="name" required className="h-12 rounded-xl bg-card px-4" />
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">Correo electrónico</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input id="email" name="email" type="email" placeholder="tu@email.com" autoComplete="email" required className="h-12 rounded-xl bg-card pl-11" />
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Contraseña</Label>
                    {!isRegister && <button type="button" className="text-xs font-medium text-accent-foreground hover:underline">¿La olvidaste?</button>}
                  </div>
                  <div className="relative">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" autoComplete={isRegister ? 'new-password' : 'current-password'} required minLength={8} className="h-12 rounded-xl bg-card px-11" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                      {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                {isRegister && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                    <Input id="confirm-password" name="confirm-password" type="password" placeholder="Repite tu contraseña" autoComplete="new-password" required minLength={8} className="h-12 rounded-xl bg-card px-4" />
                  </div>
                )}
                {!isRegister && <div className="flex items-center gap-2"><Checkbox id="remember" /><Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">Recordar sesión</Label></div>}
                <Button type="submit" className="h-12 w-full rounded-xl bg-accent text-accent-foreground shadow-lg shadow-accent/20 hover:bg-accent/90">
                  {submitted ? <><Check data-icon="inline-start" /> {isRegister ? 'Cuenta creada' : 'Sesión iniciada'}</> : <>{isRegister ? 'Crear mi cuenta' : 'Entrar a mi espacio'} <ArrowRight data-icon="inline-end" /></>}
                </Button>
              </form>
              <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">Al continuar, aceptas nuestros <button type="button" className="underline underline-offset-2 hover:text-foreground">términos de uso</button> y <button type="button" className="underline underline-offset-2 hover:text-foreground">política de privacidad</button>.</p>
            </CardContent>
          </div>
          <p className="mt-8 text-center text-xs text-muted-foreground">© 2026 Finances Finance · Diseñado para vivir con más calma</p>
        </section>
      </div>
    </main>
  )
}
