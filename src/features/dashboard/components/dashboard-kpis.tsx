"use client";

import { motion } from "framer-motion";
import { MetricCard } from "./metric-card";
import type { DashboardData } from "../types/dashboard.types";

export function DashboardKpis({ overview }: { overview: DashboardData["overview"] }) {
    return (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.values(overview).map((metric, index) =>
                <motion.div
                    key={metric.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06, duration: 0.25 }}
                >
                    <MetricCard metric={metric} />
                </motion.div>
            )}
        </section>
    );
}
