"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAppDate } from "@/src/shared/utils/local-date-time";
import { AnimatedCollapse } from "./animated-collapse";
import { TONE_TEXT } from "./forecast-ui";

export type ForecastAlertItem = {
    key: string;
    title: string;
    detail: string;
    scheduledAt: Date;
    severity: "critical" | "warning";
};

export function ForecastAlerts({ alerts }: { alerts: ForecastAlertItem[] }) {
    const [isOpen, setIsOpen] = useState(false);
    if (!alerts.length) return null;

    const sorted = [...alerts].sort((left, right) => (
        Number(right.severity === "critical") - Number(left.severity === "critical")
        || left.scheduledAt.getTime() - right.scheduledAt.getTime()
    ));
    const isCritical = sorted[0].severity === "critical";
    const canExpand = sorted.length > 1;

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
                "overflow-hidden rounded-2xl border",
                isCritical ? "border-rose-500/30 bg-rose-500/10" : "border-amber-500/30 bg-amber-500/10",
            )}
        >
            <button
                type="button"
                disabled={!canExpand}
                aria-expanded={canExpand ? isOpen : undefined}
                onClick={() => setIsOpen((current) => !current)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm enabled:cursor-pointer"
            >
                <AlertTriangle className={cn("size-4 shrink-0", isCritical ? TONE_TEXT.negative : TONE_TEXT.warning)} />
                <p className="min-w-0 flex-1 truncate">
                    {canExpand && <span className="font-semibold">{sorted.length} alertas · </span>}
                    <span className="font-medium">{sorted[0].title}</span>
                    <span className="text-muted-foreground"> · {sorted[0].detail}</span>
                </p>
                {canExpand && (
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                )}
            </button>
            <AnimatedCollapse open={canExpand && isOpen}>
                <ul className="divide-y divide-foreground/5 border-t border-foreground/5">
                    {sorted.map((alert) => (
                        <li key={alert.key} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                            <span className={cn(
                                "mt-1.5 size-1.5 shrink-0 rounded-full",
                                alert.severity === "critical" ? "bg-rose-500" : "bg-amber-500",
                            )} />
                            <p className="min-w-0 flex-1">
                                <span className="font-medium">{alert.title}</span>
                                <span className="text-muted-foreground"> · {alert.detail}</span>
                            </p>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                                {formatAppDate(alert.scheduledAt, { day: "numeric", month: "short" })}
                            </span>
                        </li>
                    ))}
                </ul>
            </AnimatedCollapse>
        </motion.section>
    );
}
