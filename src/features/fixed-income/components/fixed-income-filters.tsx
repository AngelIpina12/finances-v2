"use client";

import { Button } from "@/components/ui/button";

export type FixedIncomeFilter = "all" | "active" | "cancelled" | "settled";

const filters: Array<{ value: FixedIncomeFilter; label: string }> = [
    { value: "all", label: "Todas" },
    { value: "active", label: "Activas" },
    { value: "cancelled", label: "Canceladas" },
    { value: "settled", label: "Liquidadas" },
];

interface Props {
    value: FixedIncomeFilter;
    onChange: (value: FixedIncomeFilter) => void;
}

export function FixedIncomeFilters({ value, onChange }: Props) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-1">
            {filters.map((filter) => (
                <Button
                    key={filter.value}
                    size="sm"
                    variant={value === filter.value ? "default" : "outline"}
                    onClick={() => onChange(filter.value)}
                    className="shrink-0 cursor-pointer"
                >
                    {filter.label}
                </Button>
            ))}
        </div>
    );
}
