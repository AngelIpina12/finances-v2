"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Sheet, SheetContent, SheetDescription, SheetFooter,
    SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { SegmentedControl } from "@/src/shared/components/forms";
import type { ForecastGranularity } from "../domain/forecast-calculator";
import type { ForecastViewDraft } from "../domain/forecast-view";
import { countActiveFilters, ForecastFiltersFields } from "./forecast-filters-popover";
import {
    ForecastRangeCalendar, ForecastRangePresets, formatForecastRange,
} from "./forecast-range-picker";
import { ForecastSavingsFields } from "./forecast-savings-popover";
import {
    DAILY_GRANULARITY_MAX_DAYS, allowsDailyGranularity, forecastRangeDays,
} from "../domain/forecast-horizon";

type FiltersFieldsProps = Parameters<typeof ForecastFiltersFields>[0];
type SavingsFieldsProps = Parameters<typeof ForecastSavingsFields>[0];

interface Props {
    draft: ForecastViewDraft;
    minimumDate: string;
    maximumDate: string;
    onPresetChange: (days: number) => void;
    onRangeChange: (startsOn: string, endsOn: string) => void;
    onGranularityChange: (granularity: ForecastGranularity) => void;
    filters: FiltersFieldsProps;
    savings: SavingsFieldsProps | null;
}

export function ForecastAdjustSheet({
    draft, minimumDate, maximumDate, onPresetChange, onRangeChange,
    onGranularityChange, filters, savings,
}: Props) {
    const [open, setOpen] = useState(false);
    const allowsDaily = allowsDailyGranularity(forecastRangeDays(draft.startsOn, draft.endsOn));
    const activeCount = countActiveFilters(filters)
        + Number(draft.savingsMode !== "exclude")
        + Number(savings?.simulation != null);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant={activeCount ? "secondary" : "ghost"} className="shrink-0 cursor-pointer" />}>
                <SlidersHorizontal className="text-muted-foreground" />
                Ajustar
                {activeCount > 0 && (
                    <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums">
                        {activeCount}
                    </span>
                )}
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[88dvh] gap-0 rounded-t-3xl p-0">
                <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
                <SheetHeader className="px-5 pt-3 pb-4">
                    <SheetTitle className="font-serif text-xl tracking-[-0.02em]">Ajustar previsión</SheetTitle>
                    <SheetDescription className="tabular-nums">
                        {formatForecastRange(draft.startsOn, draft.endsOn)}
                    </SheetDescription>
                </SheetHeader>

                <div className="min-h-0 flex-1 divide-y overflow-y-auto border-y">
                    <Section title="Rango">
                        <ForecastRangePresets activePreset={draft.rangePresetDays} onPresetChange={onPresetChange} />
                        <div className="rounded-xl border">
                            <ForecastRangeCalendar
                                startsOn={draft.startsOn}
                                endsOn={draft.endsOn}
                                minimumDate={minimumDate}
                                maximumDate={maximumDate}
                                onRangeChange={onRangeChange}
                            />
                        </div>
                    </Section>
                    <Section title="Agrupar movimientos">
                        <SegmentedControl
                            items={allowsDaily ? ["day", "week", "month"] as const : ["week", "month"] as const}
                            labels={{ day: "Día", week: "Semana", month: "Mes" }}
                            value={draft.granularity}
                            onChange={onGranularityChange}
                            className="mb-0"
                        />
                        {!allowsDaily && (
                            <p className="text-xs text-muted-foreground">
                                Por día sólo está disponible en rangos de hasta {DAILY_GRANULARITY_MAX_DAYS} días.
                            </p>
                        )}
                    </Section>
                    <Section title="Filtros">
                        <ForecastFiltersFields {...filters} />
                    </Section>
                    {savings && (
                        <Section title="Ahorro">
                            <ForecastSavingsFields
                                {...savings}
                                onEditSimulation={() => {
                                    setOpen(false);
                                    savings.onEditSimulation();
                                }}
                            />
                        </Section>
                    )}
                </div>

                <SheetFooter className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <Button type="button" size="lg" onClick={() => setOpen(false)} className="w-full cursor-pointer">
                        Ver previsión
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-3 px-5 py-4">
            <h3 className="text-sm font-medium">{title}</h3>
            {children}
        </section>
    );
}
