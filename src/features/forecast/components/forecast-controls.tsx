"use client";

import { Button } from "@/components/ui/button";
import {
    DatePickerField, FormLabel, FormSelect,
    SegmentedControl,
} from "@/src/shared/components/forms";
import { toAppDateInputValue } from "@/src/shared/utils/local-date-time";
import { APP_TIME_ZONE } from "@/src/shared/constants/date-time";
import { fromZonedTime } from "date-fns-tz";
import type { ForecastGranularity } from "../domain/forecast-calculator";
import type { LinkedSavingsMode } from "../domain/linked-savings";

function parseDateInputValue(value: string) {
    if (!value) return undefined;
    const date = fromZonedTime(`${value}T00:00`, APP_TIME_ZONE);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

type Props = {
    startsAt: string;
    endsAt: string;
    minimumDate: string;
    maximumDate: string;
    currency: string;
    currencies: string[];
    granularity: ForecastGranularity;
    activePreset: number | null;
    hasLinkedSavings: boolean;
    savingsMode: LinkedSavingsMode;
    onStartsAtChange: (value: string) => void;
    onEndsAtChange: (value: string) => void;
    onCurrencyChange: (value: string) => void;
    onGranularityChange: (value: ForecastGranularity) => void;
    onPresetChange: (days: number) => void;
    onSavingsModeChange: (value: LinkedSavingsMode) => void;
};

export function ForecastControls({
    startsAt, endsAt, minimumDate, maximumDate,
    currency, currencies, granularity, activePreset,
    hasLinkedSavings, savingsMode,
    onStartsAtChange, onEndsAtChange, onCurrencyChange,
    onGranularityChange, onPresetChange, onSavingsModeChange,
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
                    <DatePickerField
                        id="forecast-start"
                        value={parseDateInputValue(startsAt)}
                        min={parseDateInputValue(minimumDate)}
                        max={parseDateInputValue(maximumDate)}
                        onChange={(date) => onStartsAtChange(date ? toAppDateInputValue(date) : "")}
                    />
                </div>
                <div className="space-y-2">
                    <FormLabel htmlFor="forecast-end">Hasta</FormLabel>
                    <DatePickerField
                        id="forecast-end"
                        value={parseDateInputValue(endsAt)}
                        min={parseDateInputValue(startsAt)}
                        max={parseDateInputValue(maximumDate)}
                        onChange={(date) => onEndsAtChange(date ? toAppDateInputValue(date) : "")}
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

            {hasLinkedSavings && (
                <div className="flex flex-col gap-2 md:max-w-xl">
                    <FormLabel>Cajitas</FormLabel>
                    <SegmentedControl
                        items={["exclude", "principal", "with_yield"] as const}
                        labels={{ exclude: "Sin cajitas", principal: "Con cajitas", with_yield: "Con cajitas y rendimiento" }}
                        value={savingsMode}
                        onChange={onSavingsModeChange}
                        className="mb-0"
                    />
                    <p className="text-xs text-muted-foreground">
                        {savingsMode === "exclude"
                            ? "Las cuentas muestran sólo su propio saldo; lo guardado en cajitas no se contempla."
                            : savingsMode === "principal"
                                ? "El saldo de cada cajita se suma a su cuenta de fondeo, sin rendimiento futuro."
                                : "El saldo de cada cajita y su rendimiento diario estimado se suman a su cuenta de fondeo."}
                    </p>
                </div>
            )}
        </section>
    );
}
