"use client";

import {
    createContext, useContext, useEffect,
    useSyncExternalStore,
} from "react";
import {
    DEFAULT_PALETTE_ID, PALETTE_STORAGE_KEY, PALETTES,
    getPalette, isPaletteId,
} from "@/src/shared/constants/palettes";
import { useTheme } from "./theme-provider";

interface PaletteContextValue {
    palette: string;
    setPalette: (palette: string) => void;
    palettes: typeof PALETTES;
}

const PALETTE_CHANGE_EVENT = "finances:palette-change";
const PaletteContext = createContext<PaletteContextValue | undefined>(
    undefined,
);

function getStoredPalette(): string {
    try {
        const stored = localStorage.getItem(PALETTE_STORAGE_KEY);
        return isPaletteId(stored) ? (stored as string) : DEFAULT_PALETTE_ID;
    } catch {
        return DEFAULT_PALETTE_ID;
    }
}

function getServerStoredPalette(): string {
    return DEFAULT_PALETTE_ID;
}

function subscribeToStoredPalette(onChange: () => void) {
    window.addEventListener("storage", onChange);
    window.addEventListener(PALETTE_CHANGE_EVENT, onChange);

    return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener(PALETTE_CHANGE_EVENT, onChange);
    };
}

function applyPalette(paletteId: string, mode: "light" | "dark") {
    const root = document.documentElement;
    const vars = getPalette(paletteId)[mode];

    for (const [key, value] of Object.entries(vars)) {
        root.style.setProperty(key, value);
    }
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
    const { resolvedTheme } = useTheme();
    const palette = useSyncExternalStore<string>(
        subscribeToStoredPalette,
        getStoredPalette,
        getServerStoredPalette,
    );

    useEffect(() => {
        applyPalette(palette, resolvedTheme);
    }, [palette, resolvedTheme]);

    function setPalette(nextPalette: string) {
        try {
            localStorage.setItem(PALETTE_STORAGE_KEY, nextPalette);
        } catch {

        }

        window.dispatchEvent(new Event(PALETTE_CHANGE_EVENT));
    }

    return (
        <PaletteContext.Provider value={{ palette, setPalette, palettes: PALETTES }}>
            {children}
        </PaletteContext.Provider>
    );
}

export function usePalette() {
    const context = useContext(PaletteContext);

    if (!context) {
        throw new Error("usePalette must be used within PaletteProvider");
    }

    return context;
}
