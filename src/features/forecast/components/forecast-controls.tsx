"use client";

import { Button } from "@/components/ui/button";
import {
    FormInput, FormLabel, FormSelect,
    SegmentedControl,
} from "@/src/shared/components/forms";
import type { ForecastGranularity } from "../domain/forecast-calculator";

type Props = {
    startsAt: string;
    endsAt: string;
    minimumDate: string;
    maximumDate: string;
    currency: string;
    currencies: string[];
    granularity: ForecastGranularity;
    activePreset: number | null;
    onStartsAtChange: (value: string) => void;
    onEndsAtChange: (value: string) => void;
    onCurrencyChange: (value: string) => void;
    onGranularityChange: (value: ForecastGranularity) => void;
    onPresetChange: (days: number) => void;
};

export function ForecastControls({
    startsAt, endsAt, minimumDate, maximumDate,
    currency, currencies, granularity, activePreset,
    onStartsAtChange, onEndsAtChange, onCurrencyChange,
    onGranularityChange, onPresetChange,
}: Props) {
    return (
        <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
                {[30, 60, 90].map((days) => (
                    <Button
                        key={days}
                        type="button"
                        size="sm"
                        variant={activePreset === days ? "default" : "outline"}
                        onClick={() => onPresetChange(days)}
                        className="cursor-pointer"
                    >
                        {days} días
                    </Button>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                    <FormLabel htmlFor="forecast-start">Desde</FormLabel>
                    <FormInput
                        id="forecast-start"
                        type="date"
                        value={startsAt}
                        min={minimumDate}
                        max={maximumDate}
                        onChange={(event) => onStartsAtChange(event.target.value)}
                    />
                </div>
                <div className="space-y-2">
                    <FormLabel htmlFor="forecast-end">Hasta</FormLabel>
                    <FormInput
                        id="forecast-end"
                        type="date"
                        value={endsAt}
                        min={startsAt}
                        max={maximumDate}
                        onChange={(event) => onEndsAtChange(event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">La fecha final no se incluye.</p>
                </div>
                <div className="space-y-2">
                    <FormLabel>Moneda</FormLabel>
                    <FormSelect
                        value={currency}
                        onValueChange={onCurrencyChange}
                        options={[
                            { value: "all", label: "Todas las monedas" },
                            ...currencies.map((item) => ({ value: item, label: item })),
                        ]}
                    />
                </div>
                <div className="space-y-2">
                    <FormLabel>Agrupación</FormLabel>
                    <SegmentedControl
                        items={["day", "week", "month"] as const}
                        labels={{ day: "Día", week: "Semana", month: "Mes" }}
                        value={granularity}
                        onChange={onGranularityChange}
                    />
                </div>
            </div>
        </section>
    );
}
