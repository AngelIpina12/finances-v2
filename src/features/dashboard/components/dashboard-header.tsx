"use client";

import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CardTitle } from "@/src/shared/components/ui/card";
import { getAppHour } from "@/src/shared/utils/local-date-time";

interface Props {
    userName?: string;
    periodLabel: string;
}

export function DashboardHeader({ userName, periodLabel }: Props) {
    const hour = getAppHour();
    const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
    const firstName = userName?.split(" ")[0];
    const overview = `${greeting}${firstName ? `, ${firstName}` : ""}. Aquí está tu panorama financiero de ${periodLabel}.`;

    return (
        <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
            <div className="space-y-2">
                <p className="font-label text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground">
                    Todo en un solo lugar
                </p>
                <CardTitle className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">
                    Resumen
                </CardTitle>
                <p className="text-muted-foreground">
                    {overview}
                </p>
            </div>
            <div className="flex flex-wrap gap-2">
                <span className="inline-flex h-9 items-center rounded-lg border bg-background px-3 text-sm text-muted-foreground capitalize">
                    {periodLabel}
                </span>
                <Button
                    nativeButton={false}
                    render={<Link href="/transactions" />}
                >
                    <Plus />
                    Agregar transacción
                </Button>
            </div>
        </motion.header>
    );
}
