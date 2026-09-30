export const DOCK_STORAGE_KEY = "dock-position";

export const DOCK_POSITIONS = ["bottom", "top", "left", "right"] as const;

export type DockPosition = (typeof DOCK_POSITIONS)[number];

export const DEFAULT_DOCK_POSITION: DockPosition = "bottom";

export function isDockPosition(value: unknown): value is DockPosition {
    return DOCK_POSITIONS.includes(value as DockPosition);
}

export const DOCK_MAGNIFICATION_STORAGE_KEY = "dock-magnification";

// Factor de crecimiento del ícono bajo el cursor respecto a su tamaño en reposo (1 = sin magnificación)
export const DOCK_MAGNIFICATION = { min: 1, max: 2.2, step: 0.1, default: 1.6 } as const;

export type DockRange = { min: number; max: number; step: number; default: number };

// Lee un valor numérico guardado y lo limita al rango; si no es válido usa el valor por defecto
export function parseDockRange(value: string | null, range: DockRange): number {
    const parsed = Number(value);
    if (value === null || !Number.isFinite(parsed)) return range.default;
    return Math.min(range.max, Math.max(range.min, parsed));
}

export const DOCK_AUTOHIDE_STORAGE_KEY = "dock-autohide";

export const DOCK_BACKGROUND_STORAGE_KEY = "dock-background";

// "glass": fondo neutro translúcido; "theme": color primario de la paleta activa
export const DOCK_BACKGROUNDS = ["glass", "theme"] as const;

export type DockBackground = (typeof DOCK_BACKGROUNDS)[number];

export const DEFAULT_DOCK_BACKGROUND: DockBackground = "glass";

export function isDockBackground(value: unknown): value is DockBackground {
    return DOCK_BACKGROUNDS.includes(value as DockBackground);
}

export const DOCK_TRANSPARENCY_STORAGE_KEY = "dock-transparency";

// Porcentaje de transparencia del fondo del dock (0 = sólido, 100 = invisible)
export const DOCK_TRANSPARENCY = { min: 0, max: 100, step: 5, default: 40 } as const;

export const DOCK_BLUR_STORAGE_KEY = "dock-blur";

// Desenfoque en px de lo que queda detrás del dock (0 = se ve nítido)
export const DOCK_BLUR = { min: 0, max: 24, step: 1, default: 4 } as const;

// Se aplica antes de pintar para que el layout (variantes `dock-*` en globals.css) no parpadee
export const DOCK_INITIALIZATION_SCRIPT = `
(() => {
    try {
        var positions = ${JSON.stringify(DOCK_POSITIONS)};
        var stored = localStorage.getItem("${DOCK_STORAGE_KEY}");
        var root = document.documentElement;
        root.dataset.dock = positions.indexOf(stored) >= 0 ? stored : "${DEFAULT_DOCK_POSITION}";
        if (localStorage.getItem("${DOCK_AUTOHIDE_STORAGE_KEY}") === "true") root.dataset.dockAutohide = "";
        var backgrounds = ${JSON.stringify(DOCK_BACKGROUNDS)};
        var background = localStorage.getItem("${DOCK_BACKGROUND_STORAGE_KEY}");
        root.dataset.dockBackground = backgrounds.indexOf(background) >= 0 ? background : "${DEFAULT_DOCK_BACKGROUND}";
        var readRange = function (key, range) {
            var value = localStorage.getItem(key);
            var parsed = Number(value);
            if (value === null || !isFinite(parsed)) return range.default;
            return Math.min(range.max, Math.max(range.min, parsed));
        };
        var transparency = readRange("${DOCK_TRANSPARENCY_STORAGE_KEY}", ${JSON.stringify(DOCK_TRANSPARENCY)});
        root.style.setProperty("--dock-opacity", (100 - transparency) + "%");
        root.style.setProperty("--dock-blur", readRange("${DOCK_BLUR_STORAGE_KEY}", ${JSON.stringify(DOCK_BLUR)}) + "px");
    } catch {}
})();
`;
