"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup,
    DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";

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
    accounts: Array<{ id: string; name: string }>;
    selectedAccountIds: Set<string>;
    onSelectedAccountIdsChange: (accountIds: Set<string>) => void;
}

export function TransactionFilters({
    value, onChange, accounts, selectedAccountIds, onSelectedAccountIdsChange,
}: Props) {
    const selectedCount = selectedAccountIds.size;

    function toggleAccount(accountId: string) {
        const next = new Set(selectedAccountIds);
        if (next.has(accountId)) next.delete(accountId);
        else next.add(accountId);
        onSelectedAccountIdsChange(next);
    }

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
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={(
                        <Button size="sm" variant={selectedCount ? "default" : "outline"} className="shrink-0 cursor-pointer">
                            {selectedCount ? `Cuentas (${selectedCount})` : "Cuentas"}
                        </Button>
                    )}
                />
                <DropdownMenuContent align="end" className="min-w-56">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Filtrar por cuentas</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {accounts.map((account) => (
                            <DropdownMenuCheckboxItem
                                key={account.id}
                                checked={selectedAccountIds.has(account.id)}
                                onCheckedChange={() => toggleAccount(account.id)}
                            >
                                {account.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuGroup>
                    {selectedCount > 0 && (
                        <>
                            <DropdownMenuSeparator />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-full cursor-pointer justify-start"
                                onClick={() => onSelectedAccountIdsChange(new Set())}
                            >
                                Mostrar todas
                            </Button>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
