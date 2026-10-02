"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
    DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";

export type ForecastAccountKind = "all" | "debit" | "credit";

const kinds: Array<{ value: ForecastAccountKind; label: string }> = [
    { value: "all", label: "Todas" },
    { value: "debit", label: "Débito" },
    { value: "credit", label: "Crédito" },
];

export function matchesAccountKind(type: string, kind: ForecastAccountKind) {
    if (kind === "all") return true;
    if (kind === "credit") return type === "credit";
    return type === "debit" || type === "cash" || type === "wallet";
}

interface Props {
    kind: ForecastAccountKind;
    onKindChange: (kind: ForecastAccountKind) => void;
    accounts: Array<{ id: string; name: string; currency: string }>;
    selectedAccountIds: Set<string>;
    onSelectedAccountIdsChange: (accountIds: Set<string>) => void;
}

export function ForecastAccountFilters({ kind, onKindChange, accounts, selectedAccountIds, onSelectedAccountIdsChange }: Props) {
    const selectedCount = selectedAccountIds.size;

    function toggleAccount(accountId: string) {
        const next = new Set(selectedAccountIds);
        if (next.has(accountId)) next.delete(accountId);
        else next.add(accountId);
        onSelectedAccountIdsChange(next);
    }

    return (
        <div className="flex gap-2 overflow-x-auto pb-1">
            {kinds.map((item) => (
                <Button
                    key={item.value}
                    type="button"
                    size="sm"
                    variant={kind === item.value ? "default" : "outline"}
                    onClick={() => onKindChange(item.value)}
                    className="shrink-0 cursor-pointer"
                >
                    {item.label}
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
                                {account.name} · {account.currency}
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
