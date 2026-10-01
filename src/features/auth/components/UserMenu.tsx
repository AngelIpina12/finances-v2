"use client";

import { LogOut, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/src/lib/auth-client";
import { Button } from "@/components/ui/button";
import { DockButton, DockSlot, useDock } from "@/src/shared/components/ui/dock-primitives";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/shared/components/ui/popover";

type UserMenuProps = {
    name?: string | null;
    email?: string | null;
};

function getInitials(name?: string | null) {
    return (name?.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2) || "U").toUpperCase();
}

export function UserMenu({ name, email }: UserMenuProps) {
    const { popoverSide, onMenuOpenChange } = useDock();
    const [isSigningOut, setIsSigningOut] = useState(false);

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
        <DockSlot>
            <Popover onOpenChange={onMenuOpenChange}>
                <PopoverTrigger
                    render={(props) => (
                        <DockButton {...props} label={name || "Mi cuenta"}>
                            {/* El avatar escala con el ícono magnificado del dock */}
                            <span className="grid size-[calc(var(--dock-icon)*1.4)] place-items-center rounded-full bg-primary text-[calc(var(--dock-icon)*0.5)] font-semibold text-primary-foreground dock-theme:bg-primary-foreground dock-theme:text-primary">
                                {getInitials(name)}
                            </span>
                        </DockButton>
                    )}
                />
                <PopoverContent side={popoverSide} sideOffset={12} className="w-64 p-1">
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
                </PopoverContent>
            </Popover>
        </DockSlot>
    );
}
