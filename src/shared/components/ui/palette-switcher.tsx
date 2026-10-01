"use client";

import { Check, Palette as PaletteIcon } from "lucide-react";
import { usePalette } from "@/src/components/providers/palette-provider";
import { Button } from "./button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "./popover";
import { cn } from "@/lib/utils";

export function PaletteSwitcher() {
    return (
        <Popover>
            <PopoverTrigger
                render={
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label="Cambiar paleta de colores"
                        title="Cambiar paleta de colores"
                        className="cursor-pointer"
                    >
                        <PaletteIcon />
                    </Button>
                }
            />
            <PopoverContent align="end" className="w-56">
                <PaletteOptions />
            </PopoverContent>
        </Popover>
    );
}

// Lista de paletas, compartida con el menú de paleta del dock
export function PaletteOptions() {
    const { palette, setPalette, palettes } = usePalette();

    return (
        <>
            <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
                Paleta de colores
            </p>
            <div className="flex flex-col gap-0.5">
                {palettes.map((preset) => {
                    const active = preset.id === palette;

                    return (
                        <button
                            key={preset.id}
                            type="button"
                            onClick={() => setPalette(preset.id)}
                            className={cn(
                                "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                                active && "bg-muted",
                            )}
                        >
                            <span
                                className="size-5 shrink-0 rounded-full ring-1 ring-foreground/10"
                                style={{ backgroundColor: preset.swatch }}
                                aria-hidden="true"
                            />
                            <span className="flex-1">{preset.name}</span>
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
        </>
    );
}
