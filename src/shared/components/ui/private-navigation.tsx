"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMotionValue, useReducedMotion } from "framer-motion";
import {
    ArrowLeftRight,
    CalendarClock,
    ChartLine,
    HandCoins,
    Landmark,
    LayoutDashboard,
    PiggyBank,
    Tags,
    Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDockAutohide, useDockMagnification, useDockPosition } from "@/src/shared/hooks/use-dock-position";
import { UserMenu } from "@/src/features/auth/components/UserMenu";
import {
    DOCK_POPOVER_SIDE,
    DockActiveIndicator,
    DockContext,
    DockSeparator,
    DockSlot,
    DockTooltip,
    dockItemClassName,
    type DockLayout,
} from "./dock-primitives";
import { DockPaletteMenu } from "./dock-palette-menu";
import { DockSettingsMenu } from "./dock-settings-menu";
import { DockThemeToggle } from "./dock-theme-toggle";

const items = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/accounts", label: "Cuentas", icon: Wallet },
    { href: "/transactions", label: "Movimientos", icon: ArrowLeftRight },
    { href: "/scheduled", label: "Programados", icon: CalendarClock },
    { href: "/financing", label: "Financiamientos", icon: HandCoins },
    { href: "/budgets", label: "Presupuestos", icon: PiggyBank },
    { href: "/forecast", label: "Previsión", icon: ChartLine },
    { href: "/fixed-income", label: "Renta fija", icon: Landmark },
    { href: "/categories", label: "Categorías", icon: Tags },
] as const;

// Tamaño en px del ícono en reposo; en escritorio se reduce (hasta `min`) si el dock no cabe en la pantalla
const BASE_SIZE = { mobile: 36, desktop: 44, min: 28 };
// Cuántos controles hay después del separador (tema, paleta, ajustes del dock y usuario)
const ACTION_COUNT = 4;
// Espacio en px del dock que no son íconos: márgenes a la pantalla, padding, borde y separador
const DOCK_CHROME = 2 * 12 + 2 * 8 + 2 + 9;
const DOCK_GAP = 8;
// Espera antes de volver a esconder el dock al alejar el cursor
const HIDE_DELAY_MS = 400;

// Las posiciones se resuelven por CSS (variantes dock-* en globals.css) para no parpadear al cargar
const navPositionClasses = cn(
    "dock-bottom:inset-x-0 dock-bottom:bottom-3 dock-bottom:justify-center dock-bottom:px-2",
    "dock-top:inset-x-0 dock-top:top-3 dock-top:justify-center dock-top:px-2",
    "dock-left:inset-y-0 dock-left:left-3 dock-left:items-center dock-left:py-2",
    "dock-right:inset-y-0 dock-right:right-3 dock-right:items-center dock-right:py-2",
);

// Franja pegada al borde de la pantalla que, con el ocultado automático, vuelve a mostrar el dock
const hotZonePositionClasses = cn(
    "dock-bottom:inset-x-0 dock-bottom:bottom-0 dock-bottom:h-1.5",
    "dock-top:inset-x-0 dock-top:top-0 dock-top:h-1.5",
    "dock-left:inset-y-0 dock-left:left-0 dock-left:w-1.5",
    "dock-right:inset-y-0 dock-right:right-0 dock-right:w-1.5",
);

// El eje fijo mantiene la base del dock estable; los íconos magnificados sobresalen hacia el contenido
const shelfPositionClasses = cn(
    "dock-bottom:max-w-full dock-bottom:items-end sm:dock-bottom:h-(--dock-thickness)",
    "dock-top:max-w-full dock-top:items-start sm:dock-top:h-(--dock-thickness)",
    "dock-left:max-h-full dock-left:flex-col dock-left:items-start sm:dock-left:w-(--dock-thickness)",
    "dock-right:max-h-full dock-right:flex-col dock-right:items-end sm:dock-right:w-(--dock-thickness)",
);

const desktopQuery = "(min-width: 640px)";

function useIsDesktop() {
    return useSyncExternalStore(
        (onChange) => {
            const media = window.matchMedia(desktopQuery);
            media.addEventListener("change", onChange);
            return () => media.removeEventListener("change", onChange);
        },
        () => window.matchMedia(desktopQuery).matches,
        () => true,
    );
}

// Medida de la ventana sobre el eje del dock, para saber cuánto espacio tiene
function useViewportExtent(vertical: boolean) {
    return useSyncExternalStore(
        (onChange) => {
            window.addEventListener("resize", onChange);
            return () => window.removeEventListener("resize", onChange);
        },
        () => (vertical ? window.innerHeight : window.innerWidth),
        () => Infinity,
    );
}

function fitBaseSize(extent: number) {
    const count = items.length + ACTION_COUNT;
    const available = extent - DOCK_CHROME - count * DOCK_GAP;
    return Math.max(BASE_SIZE.min, Math.min(BASE_SIZE.desktop, Math.floor(available / count)));
}

type PrivateNavigationProps = {
    user: { name?: string | null; email?: string | null };
};

export function PrivateNavigation({ user }: PrivateNavigationProps) {
    const pathname = usePathname();
    const isDesktop = useIsDesktop();
    const reduceMotion = useReducedMotion();
    const position = useDockPosition();
    const magnification = useDockMagnification();
    const autohide = useDockAutohide();
    const [revealed, setRevealed] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const pointerInside = useRef(false);
    const hideTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
    const vertical = position === "left" || position === "right";
    // Posición del cursor sobre el eje del dock; Infinity significa "fuera del dock" (sin magnificación)
    const mouse = useMotionValue(Infinity);

    const viewportExtent = useViewportExtent(vertical);

    const baseSize = isDesktop ? fitBaseSize(viewportExtent) : BASE_SIZE.mobile;
    const maxSize = isDesktop && !reduceMotion ? Math.round(baseSize * magnification) : baseSize;
    const layout = useMotionValue<DockLayout>({ vertical, baseSize, maxSize });

    useEffect(() => {
        document.documentElement.dataset.dock = position;
    }, [position]);

    useEffect(() => {
        layout.set({ vertical, baseSize, maxSize });
    }, [layout, vertical, baseSize, maxSize]);

    useEffect(() => () => clearTimeout(hideTimeout.current), []);

    function reveal() {
        clearTimeout(hideTimeout.current);
        setRevealed(true);
    }

    function scheduleHide() {
        clearTimeout(hideTimeout.current);
        hideTimeout.current = setTimeout(() => setRevealed(false), HIDE_DELAY_MS);
    }

    const dock = useMemo(
        () => ({
            mouse,
            layout,
            popoverSide: DOCK_POPOVER_SIDE[position],
            onMenuOpenChange: (open: boolean) => {
                setMenuOpen(open);
                // Al cerrar un menú con el cursor fuera del dock, se esconde como de costumbre
                if (!open && !pointerInside.current) {
                    clearTimeout(hideTimeout.current);
                    hideTimeout.current = setTimeout(() => setRevealed(false), HIDE_DELAY_MS);
                }
            },
        }),
        [mouse, layout, position],
    );

    return (
        <>
            {autohide && (
                <div
                    aria-hidden="true"
                    onPointerEnter={reveal}
                    onPointerLeave={scheduleHide}
                    className={cn("fixed z-20 hidden sm:block", hotZonePositionClasses)}
                />
            )}
            <div className={cn("pointer-events-none fixed z-20 flex", navPositionClasses)}>
                <DockContext.Provider value={dock}>
                    <div
                        // Con el ocultado automático, globals.css lo esconde mientras no tenga data-revealed
                        data-dock-shelf=""
                        // Grosor fijo del dock: ícono en reposo + padding y borde
                        style={{ "--dock-thickness": `${baseSize + 18}px` } as CSSProperties}
                        data-revealed={revealed || menuOpen || undefined}
                        onPointerEnter={() => {
                            pointerInside.current = true;
                            reveal();
                        }}
                        onPointerMove={(event) => {
                            if (event.pointerType === "mouse") mouse.set(vertical ? event.clientY : event.clientX);
                        }}
                        onPointerLeave={() => {
                            pointerInside.current = false;
                            mouse.set(Infinity);
                            scheduleHide();
                        }}
                        onFocus={reveal}
                        onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) scheduleHide();
                        }}
                        className={cn(
                            "pointer-events-auto flex gap-1 overflow-auto rounded-2xl border border-border/50 p-1.5 shadow-lg shadow-black/10 transition-[translate] duration-300 ease-out motion-reduce:transition-none sm:gap-2 sm:overflow-visible sm:p-2",
                            // Fondo y desenfoque salen de globals.css (tipo de fondo, transparencia y desenfoque elegidos)
                            "dock-theme:border-primary-foreground/15",
                            shelfPositionClasses,
                        )}
                    >
                        <nav aria-label="Navegación principal" className="contents">
                            {items.map((item) => (
                                <DockLink
                                    key={item.href}
                                    href={item.href}
                                    label={item.label}
                                    icon={item.icon}
                                    active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                                />
                            ))}
                        </nav>
                        <DockSeparator />
                        <div role="group" aria-label="Preferencias y cuenta" className="contents">
                            <DockThemeToggle />
                            <DockPaletteMenu />
                            <DockSettingsMenu />
                            <UserMenu name={user.name} email={user.email} />
                        </div>
                    </div>
                </DockContext.Provider>
            </div>
        </>
    );
}

type DockLinkProps = {
    href: string;
    label: string;
    icon: (typeof items)[number]["icon"];
    active: boolean;
};

function DockLink({ href, label, icon: Icon, active }: DockLinkProps) {
    return (
        <DockSlot>
            <Link
                href={href as never}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={dockItemClassName(active)}
            >
                <Icon strokeWidth={1.75} />
                <DockTooltip label={label} />
                {active && <DockActiveIndicator />}
            </Link>
        </DockSlot>
    );
}
