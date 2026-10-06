"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Layers3, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel,
    DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ForecastGranularity } from "../domain/forecast-calculator";
import type { LinkedSavings, LinkedSavingsMode } from "../domain/linked-savings";
import type {
    ForecastViewAccountKind, ForecastViewDraft, SavedForecastView,
} from "../domain/forecast-view";
import { ACCOUNT_KIND_LABELS, ForecastFiltersPopover } from "./forecast-filters-popover";
import { ForecastRangePicker } from "./forecast-range-picker";
import {
    ForecastSavingsPopover, ForecastSimulationDialog, SAVINGS_MODE_LABELS,
} from "./forecast-savings-popover";
import { ForecastAdjustSheet } from "./forecast-adjust-sheet";
import {
    DAILY_GRANULARITY_MAX_DAYS, allowsDailyGranularity, forecastRangeDays,
} from "../domain/forecast-horizon";
import type { SavedSavingsSimulation, SavingsSimulationDraft } from "./forecast-savings-simulation";
import { ForecastViewMenu } from "./forecast-view-menu";

const GRANULARITY_LABELS: Record<ForecastGranularity, string> = {
    day: "Por día",
    week: "Por semana",
    month: "Por mes",
};

type Account = { id: string; name: string; currency: string };

interface Props {
    views: SavedForecastView[];
    viewSelection: string | null;
    onViewSelect: (selection: string | null) => void;
    draft: ForecastViewDraft;
    minimumDate: string;
    maximumDate: string;
    onPresetChange: (days: number) => void;
    onRangeChange: (startsOn: string, endsOn: string) => void;
    onGranularityChange: (granularity: ForecastGranularity) => void;
    currencies: string[];
    onCurrencyChange: (currency: string) => void;
    onAccountKindChange: (kind: ForecastViewAccountKind) => void;
    accounts: Account[];
    selectableAccounts: Account[];
    selectedAccountIds: Set<string>;
    onSelectedAccountIdsChange: (accountIds: Set<string>) => void;
    onClearFilters: () => void;
    onSavingsModeChange: (mode: LinkedSavingsMode) => void;
    linkedSavings: LinkedSavings[];
    simulations: SavedSavingsSimulation[];
    simulation: SavingsSimulationDraft | null;
    onSimulationChange: (simulation: SavingsSimulationDraft | null) => void;
    focusedAccountName: string | null;
    onClearFocus: () => void;
}

export function ForecastToolbar(props: Props) {
    const {
        draft, accounts, selectedAccountIds, simulation,
        onCurrencyChange, onAccountKindChange, onSelectedAccountIdsChange,
        onSavingsModeChange, onSimulationChange, onClearFilters,
    } = props;
    const [isEditingSimulation, setIsEditingSimulation] = useState(false);
    const allowsDaily = allowsDailyGranularity(forecastRangeDays(draft.startsOn, draft.endsOn));
    const filters = {
        currency: draft.currency,
        currencies: props.currencies,
        onCurrencyChange,
        accountKind: draft.accountKind,
        onAccountKindChange,
        accounts: props.selectableAccounts,
        selectedAccountIds,
        onSelectedAccountIdsChange,
        onClear: onClearFilters,
    };
    const savings = props.linkedSavings.length
        ? {
            savingsMode: draft.savingsMode,
            onSavingsModeChange,
            accounts,
            linkedSavings: props.linkedSavings,
            simulations: props.simulations,
            simulation,
            onSimulationChange,
            onEditSimulation: () => setIsEditingSimulation(true),
        }
        : null;
    const chips: Array<{ key: string; prefix?: string; label: ReactNode; onRemove: () => void; accent?: boolean }> = [
        ...(props.focusedAccountName
            ? [{ key: "focus", prefix: "Enfoque", label: props.focusedAccountName, onRemove: props.onClearFocus, accent: true }]
            : []),
        ...(draft.currency !== "all"
            ? [{ key: "currency", prefix: "Moneda", label: draft.currency, onRemove: () => onCurrencyChange("all") }]
            : []),
        ...(draft.accountKind !== "all"
            ? [{ key: "kind", prefix: "Tipo", label: ACCOUNT_KIND_LABELS[draft.accountKind], onRemove: () => onAccountKindChange("all") }]
            : []),
        ...accounts
            .filter((account) => selectedAccountIds.has(account.id))
            .map((account) => ({
                key: `account:${account.id}`,
                label: account.name,
                onRemove: () => onSelectedAccountIdsChange(new Set([...selectedAccountIds].filter((id) => id !== account.id))),
            })),
        ...(draft.savingsMode !== "exclude"
            ? [{ key: "savings", prefix: "Cajitas", label: SAVINGS_MODE_LABELS[draft.savingsMode], onRemove: () => onSavingsModeChange("exclude") }]
            : []),
        ...(simulation
            ? [{
                key: "simulation",
                prefix: "Ahorro automático",
                label: simulation.name.trim() || "Sin guardar",
                onRemove: () => onSimulationChange(null),
                accent: true,
            }]
            : []),
    ];
    const hasFilters = draft.currency !== "all" || draft.accountKind !== "all" || selectedAccountIds.size > 0;

    return (
        <div className="sticky top-3 z-30 space-y-2 dock-top:top-[calc(var(--dock-space)+0.75rem)]">
            <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl border bg-card/90 p-1.5 shadow-sm backdrop-blur-md [scrollbar-width:none]">
                <ForecastViewMenu
                    views={props.views}
                    selection={props.viewSelection}
                    draft={draft}
                    hasUnsavedSimulation={simulation !== null && !simulation.id}
                    onSelect={props.onViewSelect}
                />
                <span className="mx-1 hidden h-5 w-px shrink-0 bg-border md:block" />
                <div className="hidden items-center gap-1.5 md:flex">
                    <ForecastRangePicker
                        startsOn={draft.startsOn}
                        endsOn={draft.endsOn}
                        minimumDate={props.minimumDate}
                        maximumDate={props.maximumDate}
                        activePreset={draft.rangePresetDays}
                        onPresetChange={props.onPresetChange}
                        onRangeChange={props.onRangeChange}
                    />
                    <DropdownMenu>
                        <DropdownMenuTrigger
                            render={(
                                <Button variant="ghost" className="shrink-0 cursor-pointer">
                                    <Layers3 className="text-muted-foreground" />
                                    {GRANULARITY_LABELS[draft.granularity]}
                                    <ChevronDown className="text-muted-foreground" />
                                </Button>
                            )}
                        />
                        <DropdownMenuContent align="start" className="min-w-40">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel>Agrupar movimientos</DropdownMenuLabel>
                                <DropdownMenuRadioGroup
                                    value={draft.granularity}
                                    onValueChange={(value) => props.onGranularityChange(value as ForecastGranularity)}
                                >
                                    {(["day", "week", "month"] as const).map((item) => (
                                        <DropdownMenuRadioItem
                                            key={item}
                                            value={item}
                                            disabled={item === "day" && !allowsDaily}
                                            className="cursor-pointer"
                                        >
                                            {GRANULARITY_LABELS[item]}
                                        </DropdownMenuRadioItem>
                                    ))}
                                </DropdownMenuRadioGroup>
                                {!allowsDaily && (
                                    <p className="max-w-48 px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
                                        Por día sólo está disponible en rangos de hasta {DAILY_GRANULARITY_MAX_DAYS} días.
                                    </p>
                                )}
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <ForecastFiltersPopover {...filters} />
                    {savings && <ForecastSavingsPopover {...savings} />}
                </div>
                <div className="md:hidden">
                    <ForecastAdjustSheet
                        draft={draft}
                        minimumDate={props.minimumDate}
                        maximumDate={props.maximumDate}
                        onPresetChange={props.onPresetChange}
                        onRangeChange={props.onRangeChange}
                        onGranularityChange={props.onGranularityChange}
                        filters={filters}
                        savings={savings}
                    />
                </div>
            </div>

            {chips.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                    {chips.map((chip) => (
                        <Badge
                            key={chip.key}
                            variant="outline"
                            className={cn(
                                "h-7 gap-1.5 rounded-full pr-1 pl-2.5 font-normal",
                                chip.accent
                                    ? "border-primary/25 bg-primary/10 text-primary"
                                    : "bg-card/60 text-muted-foreground",
                            )}
                        >
                            {chip.prefix && <span className="opacity-70">{chip.prefix}</span>}
                            <span className={chip.accent ? "font-medium" : "font-medium text-foreground"}>{chip.label}</span>
                            <button
                                type="button"
                                aria-label={`Quitar ${chip.prefix ?? ""} ${typeof chip.label === "string" ? chip.label : ""}`.trim()}
                                onClick={chip.onRemove}
                                className="grid size-5 cursor-pointer place-items-center rounded-full opacity-60 transition hover:bg-foreground/10 hover:opacity-100"
                            >
                                <X className="size-3!" />
                            </button>
                        </Badge>
                    ))}
                    {hasFilters && (
                        <button
                            type="button"
                            onClick={onClearFilters}
                            className="ml-1 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                        >
                            Limpiar filtros
                        </button>
                    )}
                </div>
            )}
            <ForecastSimulationDialog
                open={isEditingSimulation}
                onOpenChange={setIsEditingSimulation}
                accounts={accounts}
                linkedSavings={props.linkedSavings}
                simulations={props.simulations}
                simulation={simulation}
                onSimulationChange={onSimulationChange}
            />
        </div>
    );
}
