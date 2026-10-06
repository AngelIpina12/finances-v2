import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ForecastTone = "positive" | "negative" | "warning" | "accent" | "neutral";

export const TONE_TEXT: Record<ForecastTone, string> = {
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-rose-600 dark:text-rose-400",
    warning: "text-amber-600 dark:text-amber-400",
    accent: "text-primary",
    neutral: "text-foreground",
};

export const TONE_SURFACE: Record<ForecastTone, string> = {
    positive: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    negative: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    accent: "bg-primary/10 text-primary",
    neutral: "bg-muted text-muted-foreground",
};

export function formatMoney(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency", currency, maximumFractionDigits: 2,
    }).format(value);
}

export function formatSignedMoney(value: number, currency: string) {
    if (value === 0) return formatMoney(0, currency);
    return `${value > 0 ? "+" : "−"}${formatMoney(Math.abs(value), currency)}`;
}

export function toneOf(value: number, { inverted = false } = {}): ForecastTone {
    if (value === 0) return "neutral";
    return (value > 0) !== inverted ? "positive" : "negative";
}

export function Amount({ value, currency, signed = false, tone, className }: {
    value: number;
    currency: string;
    signed?: boolean;
    tone?: ForecastTone;
    className?: string;
}) {
    return (
        <span className={cn("tabular-nums", tone && TONE_TEXT[tone], className)}>
            {signed ? formatSignedMoney(value, currency) : formatMoney(value, currency)}
        </span>
    );
}

export function ForecastPanel({ className, ...props }: ComponentProps<"section">) {
    return <section className={cn("overflow-hidden rounded-2xl border bg-card", className)} {...props} />;
}

export function ForecastPanelHeader({ title, description, action, className }: {
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between", className)}>
            <div className="min-w-0">
                <h2 className="font-serif text-xl tracking-[-0.02em]">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
            </div>
            {action}
        </div>
    );
}

export function IconBadge({ tone, children, className }: { tone: ForecastTone; children: ReactNode; className?: string }) {
    return (
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl [&_svg]:size-4", TONE_SURFACE[tone], className)}>
            {children}
        </span>
    );
}
