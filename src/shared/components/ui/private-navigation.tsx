"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/accounts", label: "Cuentas" },
    { href: "/transactions", label: "Movimientos" },
    { href: "/scheduled", label: "Programados" },
    { href: "/financing", label: "Financiamientos" },
    { href: "/categories", label: "Categorías" },
] as const;

export function PrivateNavigation() {
    const pathname = usePathname();

    return (
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
            <Link href="/dashboard" className="shrink-0 font-serif text-lg font-bold tracking-tight">
                FINANCES
            </Link>
            <nav className="flex min-w-0 items-center gap-1 overflow-x-auto" aria-label="Navegación principal">
                {items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "font-heading shrink-0 rounded-lg px-2.5 py-2 text-sm font-medium tracking-[-0.01em] transition-colors sm:px-3",
                                active
                                    ? "bg-muted text-primary"
                                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                            )}
                        >
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
