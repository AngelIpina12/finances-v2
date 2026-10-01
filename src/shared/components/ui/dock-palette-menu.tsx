"use client";

import { Palette as PaletteIcon } from "lucide-react";
import { DockButton, DockSlot, useDock } from "./dock-primitives";
import { PaletteOptions } from "./palette-switcher";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export function DockPaletteMenu() {
    const { popoverSide, onMenuOpenChange } = useDock();

    return (
        <DockSlot>
            <Popover onOpenChange={onMenuOpenChange}>
                <PopoverTrigger
                    render={(props) => (
                        <DockButton {...props} label="Paleta de colores">
                            <PaletteIcon strokeWidth={1.75} />
                        </DockButton>
                    )}
                />
                <PopoverContent side={popoverSide} sideOffset={12} className="w-56">
                    <PaletteOptions />
                </PopoverContent>
            </Popover>
        </DockSlot>
    );
}
