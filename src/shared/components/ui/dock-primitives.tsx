"use client";

import { createContext, useContext, useRef, type ComponentProps, type CSSProperties } from "react";
import { motion, useSpring, useTransform, type MotionValue } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DockPosition } from "@/src/shared/constants/dock";

// Radio de influencia del cursor y resorte de la magnificación
const DISTANCE = 140;
const SPRING = { mass: 0.1, stiffness: 170, damping: 14 };

type PopoverSide = "top" | "bottom" | "left" | "right";

// Los menús del dock se abren hacia el contenido, nunca hacia el borde de la pantalla
export const DOCK_POPOVER_SIDE: Record<DockPosition, PopoverSide> = {
    bottom: "top",
    top: "bottom",
    left: "right",
    right: "left",
};

export type DockLayout = { vertical: boolean; baseSize: number; maxSize: number };

type DockContextValue = {
    mouse: MotionValue<number>;
    // Motion value para que las ranuras recalculen su tamaño sin volver a montarse (y sin cerrar menús abiertos)
    layout: MotionValue<DockLayout>;
    popoverSide: PopoverSide;
    // Mantiene visible el dock (con ocultado automático) mientras un menú suyo esté abierto
    onMenuOpenChange: (open: boolean) => void;
};

export const DockContext = createContext<DockContextValue | null>(null);

export function useDock() {
    const context = useContext(DockContext);

    if (!context) {
        throw new Error("useDock must be used within PrivateNavigation");
    }

    return context;
}

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

const separatorPositionClasses = cn(
    "dock-bottom:mx-1 dock-bottom:h-8 dock-bottom:w-px",
    "dock-top:mx-1 dock-top:h-8 dock-top:w-px",
    "dock-left:my-1 dock-left:h-px dock-left:w-8",
    "dock-right:my-1 dock-right:h-px dock-right:w-8",
);

export function dockItemClassName(active = false) {
    return cn(
        "group flex size-full cursor-pointer items-center justify-center rounded-xl transition-colors [&_svg]:size-(--dock-icon)",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
            ? "bg-muted text-primary dock-theme:bg-primary-foreground/20 dock-theme:text-primary-foreground"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground aria-expanded:bg-muted/70 aria-expanded:text-foreground dock-theme:text-primary-foreground/75 dock-theme:hover:bg-primary-foreground/15 dock-theme:hover:text-primary-foreground dock-theme:aria-expanded:bg-primary-foreground/15 dock-theme:aria-expanded:text-primary-foreground",
    );
}

// Ranura magnificable: su tamaño crece según la cercanía del cursor y expone --dock-icon a su contenido
export function DockSlot({ children }: { children: React.ReactNode }) {
    const { mouse, layout } = useDock();
    const ref = useRef<HTMLDivElement>(null);

    const targetSize = useTransform(() => {
        const pointer = mouse.get();
        const { vertical, baseSize, maxSize } = layout.get();
        const rect = ref.current?.getBoundingClientRect();
        if (!rect || !Number.isFinite(pointer)) return baseSize;

        const center = vertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
        const closeness = Math.max(0, 1 - Math.abs(pointer - center) / DISTANCE);
        return baseSize + (maxSize - baseSize) * closeness;
    });
    const size = useSpring(targetSize, SPRING);
    const iconSize = useTransform(size, (value) => `${value * 0.46}px`);

    return (
        <motion.div
            ref={ref}
            style={{ width: size, height: size, "--dock-icon": iconSize } as unknown as CSSProperties}
            className="relative shrink-0"
        >
            {children}
        </motion.div>
    );
}

export function DockTooltip({ label }: { label: string }) {
    return (
        <span
            className={cn(
                "pointer-events-none absolute hidden rounded-md border border-border/50 bg-popover/90 px-2 py-1 text-xs font-medium whitespace-nowrap text-popover-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 group-aria-expanded:hidden sm:block",
                tooltipPositionClasses,
            )}
        >
            {label}
        </span>
    );
}

export function DockActiveIndicator() {
    return <span className={cn("absolute size-1 rounded-full bg-primary dock-theme:bg-primary-foreground", indicatorPositionClasses)} />;
}

type DockButtonProps = ComponentProps<"button"> & { label: string };

export function DockButton({ label, className, children, ...props }: DockButtonProps) {
    return (
        <button type="button" aria-label={label} className={cn(dockItemClassName(), className)} {...props}>
            {children}
            <DockTooltip label={label} />
        </button>
    );
}

// Línea que separa los accesos a pantallas de las preferencias y la cuenta
export function DockSeparator() {
    return (
        <div
            role="separator"
            className={cn(
                "shrink-0 self-center rounded-full bg-border dock-theme:bg-primary-foreground/30",
                separatorPositionClasses,
            )}
        />
    );
}
