"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatAppDate } from "@/src/shared/utils/local-date-time";

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

export default function DatePickerField({
    value, onChange, placeholder = "Selecciona una fecha", disabled, min, max, className, id, name,
    "aria-label": ariaLabel,
}: Props) {
    const [open, setOpen] = useState(false);

    const today = new Date();
    const todayDisabled = (min ? today < startOfCalendarDay(min) : false)
        || (max ? today > endOfCalendarDay(max) : false);

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
                <CalendarIcon className="mr-2 size-4" />
                {value ? formatAppDate(value, { day: "numeric", month: "long", year: "numeric" }) : placeholder}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={(date) => {
                        onChange(date);
                        setOpen(false);
                    }}
                    disabled={(date) => (
                        (min ? date < startOfCalendarDay(min) : false)
                        || (max ? date > endOfCalendarDay(max) : false)
                    )}
                    defaultMonth={value ?? min ?? new Date()}
                    autoFocus
                />
                <div className="flex justify-end border-t border-foreground/10 p-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={todayDisabled}
                        onClick={() => {
                            onChange(today);
                            setOpen(false);
                        }}
                    >
                        <CalendarIcon />
                        Hoy
                    </Button>
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
