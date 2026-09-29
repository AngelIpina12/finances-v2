"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import {
  DayButton, DayPicker, type DayButtonProps,
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("relative p-3", className)}
      classNames={{
        months: "flex flex-col gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex items-center justify-center pt-1 relative",
        caption_label: "text-sm font-medium text-foreground",
        nav: "flex items-center justify-between absolute inset-x-0 top-0.5",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground hover:text-foreground",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground hover:text-foreground",
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex justify-center",
        weekday: "w-9 text-xs font-normal text-muted-foreground",
        week: "flex w-full justify-center mt-1",
        day: "relative w-9 h-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "size-9 rounded-lg p-0 font-normal text-foreground aria-selected:opacity-100",
        ),
        range_start: "rounded-l-lg",
        range_end: "rounded-r-lg",
        selected:
          "[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground",
        today: "[&>button]:ring-1 [&>button]:ring-primary/50",
        outside: "[&>button]:text-muted-foreground [&>button]:opacity-50",
        disabled: "[&>button]:text-muted-foreground [&>button]:opacity-30 [&>button]:pointer-events-none",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName, ...chevronProps }) => {
          const Icon = orientation === "left" ? ChevronLeftIcon : ChevronRightIcon
          return <Icon className={cn("size-4", chevronClassName)} {...chevronProps} />
        },
        DayButton: (dayButtonProps: DayButtonProps) => <DayButton {...dayButtonProps} />,
      }}
      {...props}
    />
  )
}

export { Calendar }
