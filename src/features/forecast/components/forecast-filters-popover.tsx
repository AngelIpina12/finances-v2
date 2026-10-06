"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { SegmentedControl } from "@/src/shared/components/forms";
import type { ForecastViewAccountKind } from "../domain/forecast-view";

export const ACCOUNT_KIND_LABELS: Record<ForecastViewAccountKind, string> = {
    all: "Todas",
    debit: "Débito",
    credit: "Crédito",
};

interface Props {
    currency: string;
    currencies: string[];
    onCurrencyChange: (currency: string) => void;
    accountKind: ForecastViewAccountKind;
    onAccountKindChange: (kind: ForecastViewAccountKind) => void;
    accounts: Array<{ id: string; name: string; currency: string }>;
    selectedAccountIds: Set<string>;
    onSelectedAccountIdsChange: (accountIds: Set<string>) => void;
    onClear: () => void;
}

export function countActiveFilters({ currency, accountKind, selectedAccountIds }: Pick<Props, "currency" | "accountKind" | "selectedAccountIds">) {
    return Number(currency !== "all") + Number(accountKind !== "all") + selectedAccountIds.size;
}

export function ForecastFiltersFields({
    currency, currencies, onCurrencyChange, accountKind, onAccountKindChange,
    accounts, selectedAccountIds, onSelectedAccountIdsChange, onClear,
}: Props) {
    const activeCount = countActiveFilters({ currency, accountKind, selectedAccountIds });
    const currencyOptions = ["all", ...currencies];

    function toggleAccount(accountId: string) {
        const next = new Set(selectedAccountIds);
        if (next.has(accountId)) next.delete(accountId);
        else next.add(accountId);
        onSelectedAccountIdsChange(next);
    }

    return (
        <div className="space-y-4">
            {currencies.length > 1 && (
                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Moneda</p>
                    <SegmentedControl
                        items={currencyOptions}
                        labels={Object.fromEntries(currencyOptions.map((item) => [item, item === "all" ? "Todas" : item]))}
                        value={currency}
                        onChange={onCurrencyChange}
                        className="mb-0"
                    />
                </div>
            )}
            <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Tipo de cuenta</p>
                <SegmentedControl
                    items={["all", "debit", "credit"] as const}
                    labels={ACCOUNT_KIND_LABELS}
                    value={accountKind}
                    onChange={onAccountKindChange}
                    className="mb-0"
                />
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Cuentas</p>
                    {selectedAccountIds.size > 0 && (
                        <button
                            type="button"
                            onClick={() => onSelectedAccountIdsChange(new Set())}
                            className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                        >
                            Todas
                        </button>
                    )}
                </div>
                <div className="max-h-56 space-y-0.5 overflow-y-auto">
                    {accounts.map((account) => (
                        <label
                            key={account.id}
                            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                        >
                            <Checkbox
                                checked={selectedAccountIds.has(account.id)}
                                onCheckedChange={() => toggleAccount(account.id)}
                            />
                            <span className="flex-1 truncate">{account.name}</span>
                            <span className="text-xs text-muted-foreground">{account.currency}</span>
                        </label>
                    ))}
                    {!accounts.length && (
                        <p className="px-2 py-1.5 text-sm text-muted-foreground">No hay cuentas con estos filtros.</p>
                    )}
                </div>
            </div>
            {activeCount > 0 && (
                <Button type="button" variant="outline" onClick={onClear} className="w-full cursor-pointer">
                    Limpiar filtros
                </Button>
            )}
        </div>
    );
}

export function ForecastFiltersPopover(props: Props) {
    const activeCount = countActiveFilters(props);

    return (
        <Popover>
            <PopoverTrigger
                render={<Button variant={activeCount ? "secondary" : "ghost"} className="shrink-0 cursor-pointer" />}
            >
                <SlidersHorizontal className="text-muted-foreground" />
                Filtros
                {activeCount > 0 && (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
                        {activeCount}
                    </span>
                )}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-4">
                <ForecastFiltersFields {...props} />
            </PopoverContent>
        </Popover>
    );
}
