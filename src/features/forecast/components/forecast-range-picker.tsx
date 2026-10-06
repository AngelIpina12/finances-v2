"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
    addAppCalendarDays, formatAppDate, toAppDateInputValue,
} from "@/src/shared/utils/local-date-time";
import { fromForecastDateInput } from "../utils/forecast-filters";
import { FORECAST_RANGE_PRESETS, formatRangePreset } from "../domain/forecast-horizon";


type RangeProps = {
    startsOn: string;
    endsOn: string;
    minimumDate: string;
    maximumDate: string;
    onRangeChange: (startsOn: string, endsOn: string) => void;
};

interface Props extends RangeProps {
    activePreset: number | null;
    onPresetChange: (days: number) => void;
}

function shiftDate(value: string, days: number) {
    const date = fromForecastDateInput(value);
    return date ? toAppDateInputValue(addAppCalendarDays(date, days)) : value;
}

function toCalendarDate(value: string) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function fromCalendarDate(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
}

function shortDate(value: string) {
    return formatAppDate(fromForecastDateInput(value)!, { day: "numeric", month: "short" });
}

export function formatForecastRange(startsOn: string, endsOn: string) {
    const lastDay = shiftDate(endsOn, -1);
    return startsOn === lastDay ? shortDate(startsOn) : `${shortDate(startsOn)} – ${shortDate(lastDay)}`;
}

export function ForecastRangePresets({ activePreset, onPresetChange, className }: Pick<Props, "activePreset" | "onPresetChange"> & {
    className?: string;
}) {
    return (
        <div className={cn("flex items-center rounded-lg bg-muted p-0.5", className)}>
            {FORECAST_RANGE_PRESETS.map((days) => (
                <button
                    key={days}
                    type="button"
                    aria-pressed={activePreset === days}
                    onClick={() => onPresetChange(days)}
                    className={cn(
                        "h-7 flex-1 cursor-pointer rounded-md px-2 text-xs font-medium whitespace-nowrap tabular-nums transition-colors",
                        activePreset === days
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                    )}
                >
                    {formatRangePreset(days)}
                </button>
            ))}
        </div>
    );
}

export function ForecastRangeCalendar({
    startsOn, endsOn, minimumDate, maximumDate, onRangeChange, numberOfMonths = 1, onPicked,
}: RangeProps & { numberOfMonths?: number; onPicked?: () => void }) {
    const [pendingStart, setPendingStart] = useState<Date | null>(null);
    const selected: DateRange = pendingStart
        ? { from: pendingStart, to: undefined }
        : { from: toCalendarDate(startsOn), to: toCalendarDate(shiftDate(endsOn, -1)) };

    function pickDay(day: Date) {
        if (!pendingStart) {
            setPendingStart(day);
            return;
        }

        const [first, last] = day < pendingStart ? [day, pendingStart] : [pendingStart, day];
        onRangeChange(fromCalendarDate(first), shiftDate(fromCalendarDate(last), 1));
        setPendingStart(null);
        onPicked?.();
    }

    return (
        <div>
            <Calendar
                mode="range"
                numberOfMonths={numberOfMonths}
                selected={selected}
                onSelect={(_, day) => pickDay(day)}
                defaultMonth={toCalendarDate(startsOn)}
                disabled={(date) => {
                    const value = fromCalendarDate(date);
                    return value < minimumDate || value >= maximumDate;
                }}
                className="mx-auto w-fit"
            />
            <p className="border-t px-3 py-2 text-xs text-muted-foreground">
                {pendingStart ? "Ahora elige el último día." : "Elige el primer y el último día del rango."}
            </p>
        </div>
    );
}

export function ForecastRangePicker({ activePreset, onPresetChange, ...range }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <div className="flex shrink-0 items-center gap-1">
            <ForecastRangePresets activePreset={activePreset} onPresetChange={onPresetChange} />
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger
                    render={(
                        <Button
                            variant={activePreset === null ? "secondary" : "ghost"}
                            className="cursor-pointer tabular-nums"
                        />
                    )}
                >
                    <CalendarDays className="text-muted-foreground" />
                    {formatForecastRange(range.startsOn, range.endsOn)}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                    <ForecastRangeCalendar {...range} numberOfMonths={2} onPicked={() => setOpen(false)} />
                </PopoverContent>
            </Popover>
        </div>
    );
}
