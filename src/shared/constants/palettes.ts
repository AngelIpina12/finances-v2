export const PALETTE_STORAGE_KEY = "palette";

export type PaletteVars = {
	"--primary": string;
	"--primary-foreground": string;
	"--accent": string;
	"--accent-foreground": string;
	"--ring": string;
	"--sidebar-primary": string;
	"--sidebar-primary-foreground": string;
	"--sidebar-accent": string;
	"--sidebar-accent-foreground": string;
	"--sidebar-ring": string;
};

export interface PalettePreset {
	id: string;
	name: string;
	swatch: string;
	light: PaletteVars;
	dark: PaletteVars;
}

export const DEFAULT_PALETTE_ID = "burgundy";

export const PALETTES: PalettePreset[] = [
	{
		id: "burgundy",
		name: "Burgundy",
		swatch: "oklch(0.38 0.15 11)",
		light: {
			"--primary": "oklch(0.32 0.15 11)",
			"--primary-foreground": "oklch(0.97 0.008 11)",
			"--accent": "oklch(0.89 0.045 11)",
			"--accent-foreground": "oklch(0.3 0.12 11)",
			"--ring": "oklch(0.44 0.14 11)",
			"--sidebar-primary": "oklch(0.32 0.15 11)",
			"--sidebar-primary-foreground": "oklch(0.97 0.008 11)",
			"--sidebar-accent": "oklch(0.89 0.045 11)",
			"--sidebar-accent-foreground": "oklch(0.3 0.12 11)",
			"--sidebar-ring": "oklch(0.44 0.14 11)",
		},
		dark: {
			"--primary": "oklch(0.38 0.15 11)",
			"--primary-foreground": "oklch(0.97 0.008 11)",
			"--accent": "oklch(0.24 0.06 11)",
			"--accent-foreground": "oklch(0.75 0.1 11)",
			"--ring": "oklch(0.44 0.14 11)",
			"--sidebar-primary": "oklch(0.38 0.15 11)",
			"--sidebar-primary-foreground": "oklch(0.97 0.008 11)",
			"--sidebar-accent": "oklch(0.24 0.06 11)",
			"--sidebar-accent-foreground": "oklch(0.75 0.1 11)",
			"--sidebar-ring": "oklch(0.44 0.14 11)",
		},
	},
	{
		id: "violet",
		name: "Violeta",
		swatch: "oklch(0.42 0.19 292)",
		light: {
			"--primary": "oklch(0.42 0.19 292)",
			"--primary-foreground": "oklch(0.98 0.01 292)",
			"--accent": "oklch(0.9 0.055 292)",
			"--accent-foreground": "oklch(0.35 0.15 292)",
			"--ring": "oklch(0.55 0.18 292)",
			"--sidebar-primary": "oklch(0.42 0.19 292)",
			"--sidebar-primary-foreground": "oklch(0.98 0.01 292)",
			"--sidebar-accent": "oklch(0.9 0.055 292)",
			"--sidebar-accent-foreground": "oklch(0.35 0.15 292)",
			"--sidebar-ring": "oklch(0.55 0.18 292)",
		},
		dark: {
			"--primary": "oklch(0.62 0.19 292)",
			"--primary-foreground": "oklch(0.97 0.01 292)",
			"--accent": "oklch(0.3 0.09 292)",
			"--accent-foreground": "oklch(0.84 0.11 292)",
			"--ring": "oklch(0.62 0.17 292)",
			"--sidebar-primary": "oklch(0.62 0.19 292)",
			"--sidebar-primary-foreground": "oklch(0.97 0.01 292)",
			"--sidebar-accent": "oklch(0.28 0.08 292)",
			"--sidebar-accent-foreground": "oklch(0.84 0.11 292)",
			"--sidebar-ring": "oklch(0.62 0.17 292)",
		},
	},
	{
		id: "aqua",
		name: "Aqua",
		swatch: "oklch(0.455 0.105 190)",
		light: {
			"--primary": "oklch(0.455 0.105 190)",
			"--primary-foreground": "oklch(0.985 0.006 190)",
			"--accent": "oklch(0.91 0.045 185)",
			"--accent-foreground": "oklch(0.355 0.09 190)",
			"--ring": "oklch(0.59 0.115 190)",
			"--sidebar-primary": "oklch(0.455 0.105 190)",
			"--sidebar-primary-foreground": "oklch(0.985 0.006 190)",
			"--sidebar-accent": "oklch(0.925 0.03 190)",
			"--sidebar-accent-foreground": "oklch(0.355 0.09 190)",
			"--sidebar-ring": "oklch(0.59 0.115 190)",
		},
		dark: {
			"--primary": "oklch(0.72 0.12 185)",
			"--primary-foreground": "oklch(0.19 0.035 190)",
			"--accent": "oklch(0.32 0.055 190)",
			"--accent-foreground": "oklch(0.79 0.11 185)",
			"--ring": "oklch(0.67 0.11 185)",
			"--sidebar-primary": "oklch(0.72 0.12 185)",
			"--sidebar-primary-foreground": "oklch(0.19 0.035 190)",
			"--sidebar-accent": "oklch(0.305 0.045 190)",
			"--sidebar-accent-foreground": "oklch(0.82 0.1 185)",
			"--sidebar-ring": "oklch(0.67 0.11 185)",
		},
	},
	{
		id: "amber",
		name: "Ámbar",
		swatch: "oklch(0.55 0.15 70)",
		light: {
			"--primary": "oklch(0.55 0.15 70)",
			"--primary-foreground": "oklch(0.98 0.02 70)",
			"--accent": "oklch(0.9 0.06 70)",
			"--accent-foreground": "oklch(0.35 0.13 70)",
			"--ring": "oklch(0.6 0.14 70)",
			"--sidebar-primary": "oklch(0.55 0.15 70)",
			"--sidebar-primary-foreground": "oklch(0.98 0.02 70)",
			"--sidebar-accent": "oklch(0.9 0.06 70)",
			"--sidebar-accent-foreground": "oklch(0.35 0.13 70)",
			"--sidebar-ring": "oklch(0.6 0.14 70)",
		},
		dark: {
			"--primary": "oklch(0.72 0.15 75)",
			"--primary-foreground": "oklch(0.18 0.03 70)",
			"--accent": "oklch(0.28 0.07 70)",
			"--accent-foreground": "oklch(0.8 0.12 75)",
			"--ring": "oklch(0.68 0.13 75)",
			"--sidebar-primary": "oklch(0.72 0.15 75)",
			"--sidebar-primary-foreground": "oklch(0.18 0.03 70)",
			"--sidebar-accent": "oklch(0.28 0.07 70)",
			"--sidebar-accent-foreground": "oklch(0.8 0.12 75)",
			"--sidebar-ring": "oklch(0.68 0.13 75)",
		},
	},
	{
		id: "emerald",
		name: "Esmeralda",
		swatch: "oklch(0.45 0.14 155)",
		light: {
			"--primary": "oklch(0.45 0.14 155)",
			"--primary-foreground": "oklch(0.98 0.02 155)",
			"--accent": "oklch(0.88 0.07 155)",
			"--accent-foreground": "oklch(0.32 0.12 155)",
			"--ring": "oklch(0.55 0.14 155)",
			"--sidebar-primary": "oklch(0.45 0.14 155)",
			"--sidebar-primary-foreground": "oklch(0.98 0.02 155)",
			"--sidebar-accent": "oklch(0.88 0.07 155)",
			"--sidebar-accent-foreground": "oklch(0.32 0.12 155)",
			"--sidebar-ring": "oklch(0.55 0.14 155)",
		},
		dark: {
			"--primary": "oklch(0.68 0.16 155)",
			"--primary-foreground": "oklch(0.16 0.03 155)",
			"--accent": "oklch(0.26 0.08 155)",
			"--accent-foreground": "oklch(0.78 0.13 155)",
			"--ring": "oklch(0.62 0.14 155)",
			"--sidebar-primary": "oklch(0.68 0.16 155)",
			"--sidebar-primary-foreground": "oklch(0.16 0.03 155)",
			"--sidebar-accent": "oklch(0.26 0.08 155)",
			"--sidebar-accent-foreground": "oklch(0.78 0.13 155)",
			"--sidebar-ring": "oklch(0.62 0.14 155)",
		},
	},
];

export function isPaletteId(value: string | null): value is string {
	return !!value && PALETTES.some((palette) => palette.id === value);
}

export function getPalette(id: string): PalettePreset {
	return PALETTES.find((palette) => palette.id === id) ?? PALETTES[0];
}

export const PALETTE_INITIALIZATION_SCRIPT = `
(() => {
    try {
        var palettes = ${JSON.stringify(
					Object.fromEntries(PALETTES.map((p) => [p.id, { light: p.light, dark: p.dark }])),
				)};
        var storedPalette = localStorage.getItem("${PALETTE_STORAGE_KEY}") || "${DEFAULT_PALETTE_ID}";
        var palette = palettes[storedPalette] || palettes["${DEFAULT_PALETTE_ID}"];
        var root = document.documentElement;
        var mode = root.classList.contains("dark") ? "dark" : "light";
        var vars = palette[mode];
        for (var key in vars) {
            root.style.setProperty(key, vars[key]);
        }
    } catch {}
})();
`;
