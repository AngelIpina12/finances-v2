import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardMetric } from "../types/dashboard.types";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function MetricCard({ metric }: { metric: DashboardMetric }) {
    const Icon = metric.trend === "up" ? ArrowUpRight : metric.trend === "down" ? ArrowDownRight : Minus;
    const isPositive = metric.positive ?? metric.trend === "up";

    return (
        <Card>
            <CardContent className="space-y-3 pt-0">
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
                    {metric.format === "percentage" ? `${metric.value}%` : money.format(metric.value)}
                </p>
                <p className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                    <Icon className="size-3.5" />
                    {metric.trendLabel}
                </p>
            </CardContent>
        </Card>
    );
}
