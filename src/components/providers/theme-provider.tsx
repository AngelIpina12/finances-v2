'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
	theme: Theme
	setTheme: (theme: Theme) => void
	resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<Theme>('system')
	const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')

	useEffect(() => {
		const stored = localStorage.getItem('theme') as Theme | null
		if (stored) {
			setThemeState(stored)
		}
	}, [])

	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

		function resolveTheme(t: Theme): 'light' | 'dark' {
			if (t === 'system') return mediaQuery.matches ? 'dark' : 'light'
			return t
		}

		function applyTheme(t: Theme) {
			const resolved = resolveTheme(t)
			setResolvedTheme(resolved)
			const root = document.documentElement
			root.classList.remove('light', 'dark')
			root.classList.add(resolved)
		}

		applyTheme(theme)

		mediaQuery.addEventListener('change', () => applyTheme(theme))
		return () => mediaQuery.removeEventListener('change', () => applyTheme(theme))
	}, [theme])

	function setTheme(t: Theme) {
		setThemeState(t)
		localStorage.setItem('theme', t)
	}

	return (
		<ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
			{children}
		</ThemeContext.Provider>
	)
}

export function useTheme() {
	const ctx = useContext(ThemeContext)
	if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
	return ctx
}
