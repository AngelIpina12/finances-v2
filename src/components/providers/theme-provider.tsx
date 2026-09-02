"use client";

import {
    createContext,
    useContext,
    useEffect,
    useSyncExternalStore,
} from "react";
import { THEME_STORAGE_KEY } from "@/src/shared/constants/theme";

type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: ResolvedTheme;
}

const THEME_CHANGE_EVENT = "finances:theme-change";
const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isTheme(value: string | null): value is Theme {
    return value === "light" || value === "dark" || value === "system";
}

function getStoredTheme(): Theme {
    try {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        return isTheme(storedTheme) ? storedTheme : "system";
    } catch {
        return "system";
    }
}

function getSystemTheme(): ResolvedTheme {
    return window.matchMedia(SYSTEM_THEME_QUERY).matches ? "dark" : "light";
}

function getServerStoredTheme(): Theme {
    return "system";
}

function getServerSystemTheme(): ResolvedTheme {
    return "light";
}

function subscribeToStoredTheme(onChange: () => void) {
    window.addEventListener("storage", onChange);
    window.addEventListener(THEME_CHANGE_EVENT, onChange);

    return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    };
}

function subscribeToSystemTheme(onChange: () => void) {
    const mediaQuery = window.matchMedia(SYSTEM_THEME_QUERY);
    mediaQuery.addEventListener("change", onChange);

    return () => mediaQuery.removeEventListener("change", onChange);
}

function applyTheme(theme: ResolvedTheme) {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const theme = useSyncExternalStore<Theme>(
        subscribeToStoredTheme,
        getStoredTheme,
        getServerStoredTheme,
    );
    const systemTheme = useSyncExternalStore<ResolvedTheme>(
        subscribeToSystemTheme,
        getSystemTheme,
        getServerSystemTheme,
    );
    const resolvedTheme = theme === "system" ? systemTheme : theme;

    useEffect(() => {
        applyTheme(resolvedTheme);
    }, [resolvedTheme]);

    function setTheme(nextTheme: Theme) {
        try {
            localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch {
            // The in-memory UI can still react when storage is unavailable.
        }

        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);

    if (!context) {
        throw new Error("useTheme must be used within ThemeProvider");
    }

    return context;
}
