"use client";

import { motion } from "framer-motion";
import {
    Card, CardContent, CardHeader,
    CardTitle
} from "@/components/ui/card";
import type { DashboardData } from "../types/dashboard.types";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export function NetWorthChart({ history }: { history: DashboardData["netWorthHistory"] }) {
    const max = Math.max(...history.map((point) => point.value));
    return (
        <Card className="xl:col-span-8">
            <CardHeader>
                <CardTitle>Evolución del patrimonio</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex h-64 items-end gap-3 border-b border-l px-4 pt-4">
                    {history.map((point, index) =>
                        <div
                            key={point.label}
                            className="flex h-full flex-1 flex-col justify-end gap-2"
                        >
                            <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${(point.value / max) * 100}%` }}
                                transition={{ delay: index * 0.08, duration: 0.45, ease: "easeOut" }}
                                className="group relative rounded-t-md bg-primary/85 hover:bg-primary"
                            >
                                <span className="absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                                    {money.format(point.value)}
                                </span>
                            </motion.div>
                            <span className="text-center text-xs text-muted-foreground">
                                {point.label}
                            </span>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
