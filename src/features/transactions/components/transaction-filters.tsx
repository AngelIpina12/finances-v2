"use client";

import { Button } from "@/components/ui/button";

export type TransactionFilter =
    | "all"
    | "expense"
    | "income"
    | "transfer"
    | "cancelled";

const filters: Array<{ value: TransactionFilter; label: string }> = [
    { value: "all", label: "Todos" },
    { value: "expense", label: "Gastos" },
    { value: "income", label: "Ingresos" },
    { value: "transfer", label: "Transferencias" },
    { value: "cancelled", label: "Cancelados" },
];

interface Props {
    value: TransactionFilter;
    onChange: (value: TransactionFilter) => void;
}

export function TransactionFilters({ value, onChange }: Props) {
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
