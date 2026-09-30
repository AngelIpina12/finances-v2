"use client";

import { Check, PanelBottom, PanelLeft, PanelRight, PanelTop, type LucideIcon } from "lucide-react";
import {
    DOCK_BLUR,
    DOCK_MAGNIFICATION,
    DOCK_TRANSPARENCY,
    type DockBackground,
    type DockPosition,
} from "@/src/shared/constants/dock";
import {
    setDockAutohide,
    setDockBackground,
    setDockBlur,
    setDockMagnification,
    setDockPosition,
    setDockTransparency,
    useDockAutohide,
    useDockBackground,
    useDockBlur,
    useDockMagnification,
    useDockPosition,
    useDockTransparency,
} from "@/src/shared/hooks/use-dock-position";
import { Button } from "./button";
import { Switch } from "./switch";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "./popover";
import { cn } from "@/lib/utils";

const options: { id: DockPosition; label: string; icon: LucideIcon }[] = [
    { id: "bottom", label: "Abajo", icon: PanelBottom },
    { id: "top", label: "Arriba", icon: PanelTop },
    { id: "left", label: "Izquierda", icon: PanelLeft },
    { id: "right", label: "Derecha", icon: PanelRight },
];

const backgroundOptions: { id: DockBackground; label: string }[] = [
    { id: "glass", label: "Transparente" },
    { id: "theme", label: "Color del tema" },
];

export function DockPositionSwitcher() {
    const position = useDockPosition();
    const magnification = useDockMagnification();
    const autohide = useDockAutohide();
    const background = useDockBackground();
    const transparency = useDockTransparency();
    const blur = useDockBlur();
    const magnificationPercent = Math.round((magnification - 1) * 100);
    const CurrentIcon = options.find((option) => option.id === position)?.icon ?? PanelBottom;

    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Ajustes del dock"
                        title="Ajustes del dock"
                        className="cursor-pointer"
                    >
                        <CurrentIcon />
                    </Button>
                }
            />
            <PopoverContent align="end" className="w-56">
                <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                    Posición del dock
                </p>
                <div className="flex flex-col gap-0.5">
                    {options.map((option) => {
                        const active = option.id === position;
                        const Icon = option.icon;

                        return (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setDockPosition(option.id)}
                                className={cn(
                                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                                    active && "bg-muted",
                                )}
                            >
                                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                                <span className="flex-1">{option.label}</span>
                                {active && (
                                    <Check
                                        className="size-4 text-foreground"
                                        aria-hidden="true"
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
                <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 border-t px-1 pt-3 text-sm">
                    <span>
                        Ocultar automáticamente
                        <span className="block text-[11px] text-muted-foreground">
                            Aparece al acercar el cursor al borde
                        </span>
                    </span>
                    <Switch checked={autohide} onCheckedChange={setDockAutohide} />
                </label>
                <div className="mt-3 border-t pt-3">
                    <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">Fondo</p>
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-0.5">
                        {backgroundOptions.map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                aria-pressed={option.id === background}
                                onClick={() => setDockBackground(option.id)}
                                className={cn(
                                    "cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                                    option.id === background && "bg-background text-foreground shadow-sm",
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
                <DockSlider
                    id="dock-transparency"
                    label="Transparencia"
                    valueLabel={transparency === 0 ? "Sólido" : `${transparency}%`}
                    range={DOCK_TRANSPARENCY}
                    value={transparency}
                    onChange={setDockTransparency}
                />
                <DockSlider
                    id="dock-blur"
                    label="Desenfoque"
                    valueLabel={blur === 0 ? "Nítido" : `${blur}px`}
                    range={DOCK_BLUR}
                    value={blur}
                    onChange={setDockBlur}
                />
                <DockSlider
                    id="dock-magnification"
                    label="Magnificación"
                    valueLabel={magnificationPercent === 0 ? "Sin efecto" : `+${magnificationPercent}%`}
                    range={DOCK_MAGNIFICATION}
                    value={magnification}
                    onChange={setDockMagnification}
                />
            </PopoverContent>
        </Popover>
    );
}

type DockSliderProps = {
    id: string;
    label: string;
    valueLabel: string;
    range: { min: number; max: number; step: number };
    value: number;
    onChange: (value: number) => void;
};

function DockSlider({ id, label, valueLabel, range, value, onChange }: DockSliderProps) {
    return (
        <div className="mt-3 border-t pt-3">
            <div className="mb-2 flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
                <label htmlFor={id}>{label}</label>
                <span className="text-foreground tabular-nums">{valueLabel}</span>
            </div>
            <input
                id={id}
                type="range"
                min={range.min}
                max={range.max}
                step={range.step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
                className="w-full cursor-pointer accent-primary"
            />
            <div className="mt-1 flex justify-between px-1 text-[11px] text-muted-foreground">
                <span>Menos</span>
                <span>Más</span>
            </div>
        </div>
    );
}
