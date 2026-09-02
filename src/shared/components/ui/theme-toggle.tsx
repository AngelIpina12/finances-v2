"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/src/components/providers/theme-provider";
import { Button } from "./button";

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const dark = resolvedTheme === "dark";
    const nextTheme = dark ? "light" : "dark";

    return (
        <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={`Cambiar a tema ${nextTheme === "dark" ? "oscuro" : "claro"}`}
            title={`Cambiar a tema ${nextTheme === "dark" ? "oscuro" : "claro"}`}
            onClick={() => setTheme(nextTheme)}
            className="relative cursor-pointer overflow-hidden"
        >
            <AnimatePresence initial={false} mode="wait">
                <motion.span
                    key={resolvedTheme}
                    initial={{ opacity: 0, rotate: -75, scale: 0.6 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 75, scale: 0.6 }}
                    transition={{ duration: 0.16, ease: "easeOut" }}
                    className="absolute grid place-items-center"
                >
                    {dark ? <Sun /> : <Moon />}
                </motion.span>
            </AnimatePresence>
        </Button>
    );
}
