"use client";

import { useState } from "react";
import { CalendarIcon, ClockIcon } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatAppDate } from "@/src/shared/utils/local-date-time";
import { APP_TIME_ZONE } from "@/src/shared/constants/date-time";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));
const SECONDS = Array.from({ length: 60 }, (_, second) => String(second).padStart(2, "0"));

type Props = {
    value: Date | undefined;
    onChange: (date: Date | undefined) => void;
    placeholder?: string;
    disabled?: boolean;
    min?: Date;
    max?: Date;
    className?: string;
    id?: string;
    name?: string;
    "aria-label"?: string;
};

export default function DateTimePickerField({
    value, onChange, placeholder = "Selecciona una fecha", disabled, min, max, className, id, name,
    "aria-label": ariaLabel,
}: Props) {
    const [open, setOpen] = useState(false);

    const timeValue = value ? formatInTimeZone(value, APP_TIME_ZONE, "HH:mm:ss") : "";
    const [hour, minute, second] = timeValue ? timeValue.split(":") : ["", "", ""];

    function combine(datePart: Date | undefined, nextHour: string, nextMinute: string, nextSecond: string) {
        if (!datePart) {
            onChange(undefined);
            return;
        }

        const dateString = formatInTimeZone(datePart, APP_TIME_ZONE, "yyyy-MM-dd");
        const timeString = `${nextHour || "00"}:${nextMinute || "00"}:${nextSecond || "00"}`;
        const combined = fromZonedTime(`${dateString}T${timeString}`, APP_TIME_ZONE);
        onChange(Number.isNaN(combined.getTime()) ? undefined : combined);
    }

    const now = new Date();
    const nowDisabled = (min ? now < startOfCalendarDay(min) : false)
        || (max ? now > endOfCalendarDay(max) : false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={
                    <Button
                        id={id}
                        name={name}
                        aria-label={ariaLabel}
                        type="button"
                        variant="outline"
                        disabled={disabled}
                        className={clsx(
                            "h-12 w-full justify-start rounded-xl bg-card px-4 font-normal cursor-pointer",
                            !value && "text-muted-foreground",
                            className,
                        )}
                    />
                }
            >
                <CalendarIcon className="mr-2 size-4 shrink-0" />
                {value
                    ? (
                        <span className="flex items-center gap-2 truncate">
                            {formatAppDate(value, { day: "numeric", month: "long", year: "numeric" })}
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <ClockIcon className="size-3.5" />
                                {timeValue}
                            </span>
                        </span>
                    )
                    : placeholder}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={(date) => combine(date, hour, minute, second)}
                    disabled={(date) => (
                        (min ? date < startOfCalendarDay(min) : false)
                        || (max ? date > endOfCalendarDay(max) : false)
                    )}
                    defaultMonth={value ?? min ?? new Date()}
                    autoFocus
                />
                <div className="flex flex-col gap-2 border-t border-foreground/10 p-2">
                    <div className="flex items-center gap-1.5">
                        <ClockIcon className="ml-1 size-4 shrink-0 text-muted-foreground" />
                        <Select
                            value={hour || undefined}
                            onValueChange={(nextHour) => combine(value, nextHour as string, minute, second)}
                            disabled={!value}
                        >
                            <SelectTrigger size="sm" className="w-0 min-w-0 flex-1 justify-center px-1">
                                <SelectValue placeholder="--" />
                            </SelectTrigger>
                            <SelectContent>
                                {HOURS.map((h) => (
                                    <SelectItem key={h} value={h}>{h}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-muted-foreground">:</span>
                        <Select
                            value={minute || undefined}
                            onValueChange={(nextMinute) => combine(value, hour, nextMinute as string, second)}
                            disabled={!value}
                        >
                            <SelectTrigger size="sm" className="w-0 min-w-0 flex-1 justify-center px-1">
                                <SelectValue placeholder="--" />
                            </SelectTrigger>
                            <SelectContent>
                                {MINUTES.map((m) => (
                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-muted-foreground">:</span>
                        <Select
                            value={second || undefined}
                            onValueChange={(nextSecond) => combine(value, hour, minute, nextSecond as string)}
                            disabled={!value}
                        >
                            <SelectTrigger size="sm" className="w-0 min-w-0 flex-1 justify-center px-1">
                                <SelectValue placeholder="--" />
                            </SelectTrigger>
                            <SelectContent>
                                {SECONDS.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex items-center gap-1.5 border-t border-foreground/10 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="flex-1"
                            disabled={nowDisabled}
                            onClick={() => combine(now, hour, minute, second)}
                        >
                            <CalendarIcon />
                            Hoy
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="flex-1"
                            disabled={!value || nowDisabled}
                            onClick={() => combine(
                                value,
                                formatInTimeZone(now, APP_TIME_ZONE, "HH"),
                                formatInTimeZone(now, APP_TIME_ZONE, "mm"),
                                formatInTimeZone(now, APP_TIME_ZONE, "ss"),
                            )}
                        >
                            <ClockIcon />
                            Ahora
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function startOfCalendarDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function endOfCalendarDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy;
}
