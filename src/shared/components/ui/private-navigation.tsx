"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    motion,
    useMotionValue,
    useReducedMotion,
    useSpring,
    useTransform,
    type MotionValue,
} from "framer-motion";
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
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDockAutohide, useDockMagnification, useDockPosition } from "@/src/shared/hooks/use-dock-position";

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

// Tamaños en px del ícono en reposo y radio de influencia del cursor; la magnificación la elige el usuario
const BASE_SIZE = { mobile: 36, desktop: 44 };
const DISTANCE = 140;
const SPRING = { mass: 0.1, stiffness: 170, damping: 14 };
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
    "dock-bottom:max-w-full dock-bottom:items-end sm:dock-bottom:h-15.5",
    "dock-top:max-w-full dock-top:items-start sm:dock-top:h-15.5",
    "dock-left:max-h-full dock-left:flex-col dock-left:items-start sm:dock-left:w-15.5",
    "dock-right:max-h-full dock-right:flex-col dock-right:items-end sm:dock-right:w-15.5",
);

const tooltipPositionClasses = cn(
    "dock-bottom:bottom-full dock-bottom:left-1/2 dock-bottom:mb-2 dock-bottom:-translate-x-1/2",
    "dock-top:top-full dock-top:left-1/2 dock-top:mt-2 dock-top:-translate-x-1/2",
    "dock-left:top-1/2 dock-left:left-full dock-left:ml-2 dock-left:-translate-y-1/2",
    "dock-right:top-1/2 dock-right:right-full dock-right:mr-2 dock-right:-translate-y-1/2",
);

const indicatorPositionClasses = cn(
    "dock-bottom:-bottom-1 dock-bottom:left-1/2 dock-bottom:-translate-x-1/2",
    "dock-top:-top-1 dock-top:left-1/2 dock-top:-translate-x-1/2",
    "dock-left:top-1/2 dock-left:-left-1 dock-left:-translate-y-1/2",
    "dock-right:top-1/2 dock-right:-right-1 dock-right:-translate-y-1/2",
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

export function PrivateNavigation() {
    const pathname = usePathname();
    const isDesktop = useIsDesktop();
    const reduceMotion = useReducedMotion();
    const position = useDockPosition();
    const magnification = useDockMagnification();
    const autohide = useDockAutohide();
    const [revealed, setRevealed] = useState(false);
    const hideTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
    const vertical = position === "left" || position === "right";
    // Posición del cursor sobre el eje del dock; Infinity significa "fuera del dock" (sin magnificación)
    const mouse = useMotionValue(Infinity);

    const baseSize = isDesktop ? BASE_SIZE.desktop : BASE_SIZE.mobile;
    const maxSize = isDesktop && !reduceMotion ? Math.round(baseSize * magnification) : baseSize;

    useEffect(() => {
        document.documentElement.dataset.dock = position;
    }, [position]);

    useEffect(() => () => clearTimeout(hideTimeout.current), []);

    function reveal() {
        clearTimeout(hideTimeout.current);
        setRevealed(true);
    }

    function scheduleHide() {
        clearTimeout(hideTimeout.current);
        hideTimeout.current = setTimeout(() => setRevealed(false), HIDE_DELAY_MS);
    }

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
            <nav
                aria-label="Navegación principal"
                className={cn("pointer-events-none fixed z-20 flex", navPositionClasses)}
            >
                <div
                    // Remonta los íconos al cambiar de eje o tamaño para recalcular sus transformaciones
                    key={`${vertical}:${baseSize}:${maxSize}`}
                    // Con el ocultado automático, globals.css lo esconde mientras no tenga data-revealed
                    data-dock-shelf=""
                    data-revealed={revealed || undefined}
                    onPointerEnter={reveal}
                    onPointerMove={(event) => {
                        if (event.pointerType === "mouse") mouse.set(vertical ? event.clientY : event.clientX);
                    }}
                    onPointerLeave={() => {
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
                    {items.map((item) => (
                        <DockItem
                            key={item.href}
                            href={item.href}
                            label={item.label}
                            icon={item.icon}
                            active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
                            mouse={mouse}
                            vertical={vertical}
                            baseSize={baseSize}
                            maxSize={maxSize}
                        />
                    ))}
                </div>
            </nav>
        </>
    );
}

type DockItemProps = {
    href: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
    mouse: MotionValue<number>;
    vertical: boolean;
    baseSize: number;
    maxSize: number;
};

function DockItem({ href, label, icon: Icon, active, mouse, vertical, baseSize, maxSize }: DockItemProps) {
    const ref = useRef<HTMLAnchorElement>(null);

    const distance = useTransform(mouse, (pointer) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect || !Number.isFinite(pointer)) return Infinity;
        return vertical ? pointer - (rect.top + rect.height / 2) : pointer - (rect.left + rect.width / 2);
    });
    const targetSize = useTransform(distance, [-DISTANCE, 0, DISTANCE], [baseSize, maxSize, baseSize]);
    const size = useSpring(targetSize, SPRING);
    const iconSize = useTransform(size, (value) => value * 0.46);

    return (
        <motion.div style={{ width: size, height: size }} className="relative shrink-0">
            <Link
                ref={ref}
                href={href as never}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={cn(
                    "group flex size-full items-center justify-center rounded-xl transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    active
                        ? "bg-muted text-primary dock-theme:bg-primary-foreground/20 dock-theme:text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground dock-theme:text-primary-foreground/75 dock-theme:hover:bg-primary-foreground/15 dock-theme:hover:text-primary-foreground",
                )}
            >
                <motion.span style={{ width: iconSize, height: iconSize }} className="flex">
                    <Icon className="size-full" strokeWidth={1.75} />
                </motion.span>
                <span
                    className={cn(
                        "pointer-events-none absolute hidden rounded-md border border-border/50 bg-popover/90 px-2 py-1 text-xs font-medium whitespace-nowrap text-popover-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 sm:block",
                        tooltipPositionClasses,
                    )}
                >
                    {label}
                </span>
                {active && (
                    <span className={cn("absolute size-1 rounded-full bg-primary dock-theme:bg-primary-foreground", indicatorPositionClasses)} />
                )}
            </Link>
        </motion.div>
    );
}
