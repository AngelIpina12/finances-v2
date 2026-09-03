"use client";

import { motion } from "framer-motion";
import {
    CalendarClock, CircleCheckBig, TriangleAlert,
} from "lucide-react";
import type { ScheduledOccurrenceListItem } from "../queries/get-scheduled-occurrence-data";

interface Props {
    occurrences: ScheduledOccurrenceListItem[];
    now: Date;
}

export function ScheduledSummary({ occurrences, now }: Props) {
    const nowTimestamp = now.getTime();
    const scheduled = occurrences.filter((item) => item.status === "scheduled");
    const overdue = scheduled.filter((item) => item.scheduledAt.getTime() < nowTimestamp).length;
    const completed = occurrences.filter((item) => item.status === "completed").length;

    const cards = [
        {
            label: "Pendientes",
            value: scheduled.length,
            detail: "Esperando confirmación",
            icon: CalendarClock,
            tone: "bg-sky-500/10 text-sky-600",
        },
        {
            label: "Vencidos",
            value: overdue,
            detail: overdue ? "Requieren atención" : "Todo está al día",
            icon: TriangleAlert,
            tone: overdue
                ? "bg-amber-500/10 text-amber-600"
                : "bg-emerald-500/10 text-emerald-600",
        },
        {
            label: "Completados",
            value: completed,
            detail: "Convertidos en movimientos",
            icon: CircleCheckBig,
            tone: "bg-emerald-500/10 text-emerald-600",
        },
    ];

    return (
        <section className="grid gap-3 sm:grid-cols-3">
            {cards.map((card, index) => (
                <motion.article
                    key={card.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-4 rounded-2xl border bg-card p-4"
                >
                    <span className={`grid size-11 place-items-center rounded-xl ${card.tone}`}>
                        <card.icon className="size-5" />
                    </span>
                    <div>
                        <p className="text-xs font-medium text-muted-foreground">
                            {card.label}
                        </p>
                        <p className="font-serif text-2xl font-semibold">
                            {card.value}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                            {card.detail}
                        </p>
                    </div>
                </motion.article>
            ))}
        </section>
    );
}
