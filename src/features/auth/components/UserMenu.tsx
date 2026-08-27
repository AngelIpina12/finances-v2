"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LogOut, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/src/lib/auth-client";
import { Button } from "@/components/ui/button";

type UserMenuProps = {
    name?: string | null;
    email?: string | null;
};

function getInitials(name?: string | null) {
    return (name?.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || "U").toUpperCase();
}

export function UserMenu({ name, email }: UserMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        function closeWhenClickingOutside(event: PointerEvent) {
            if (!menuRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        function closeOnEscape(event: KeyboardEvent) {
            if (event.key === "Escape") setIsOpen(false);
        }

        document.addEventListener("pointerdown", closeWhenClickingOutside);
        document.addEventListener("keydown", closeOnEscape);

        return () => {
            document.removeEventListener("pointerdown", closeWhenClickingOutside);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [isOpen]);

    async function handleSignOut() {
        setIsSigningOut(true);

        try {
            await signOut();
            redirect("/auth/login");
        } finally {
            setIsSigningOut(false);
        }
    }

    return (
        <div ref={menuRef} className="relative">
            <button
                type="button"
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={() => setIsOpen((open) => !open)}
                className="flex h-9 items-center gap-2 rounded-lg px-1.5 text-sm outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            >
                <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {getInitials(name)}
                </span>
                <span className="hidden max-w-36 truncate font-medium sm:block">{name || "Mi cuenta"}</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        role="menu"
                        initial={{ opacity: 0, scale: 0.96, y: -8 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -8 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
                    >
                        <div className="flex items-center gap-3 px-3 py-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                                {getInitials(name)}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{name || "Mi cuenta"}</p>
                                <p className="truncate text-xs text-muted-foreground">{email || "Sin correo"}</p>
                            </div>
                        </div>

                        <div className="my-1 border-t" />

                        <button type="button" disabled className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground opacity-60">
                            <UserRound className="size-4" />
                            Configuración próximamente
                        </button>

                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={handleSignOut}
                            disabled={isSigningOut}
                        >
                            <LogOut />
                            {isSigningOut ? "Cerrando sesión..." : "Cerrar sesión"}
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
