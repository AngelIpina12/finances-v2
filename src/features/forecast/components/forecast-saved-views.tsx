"use client";

import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import {
    Bookmark, Save, Trash2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    FormInput, FormLabel, FormSelect
} from "@/src/shared/components/forms";
import { deleteForecastView, saveForecastView } from "../actions/forecast-view-actions";
import type { ForecastViewSettings, SavedForecastView } from "../domain/forecast-view";

interface Props {
    views: SavedForecastView[];
    selection: string | null;
    settings: ForecastViewSettings & { startsOn: string; endsOn: string };
    hasUnsavedSimulation: boolean;
    onSelectionChange: (selection: string | null) => void;
}

function sameSettings(view: SavedForecastView, settings: Props["settings"]) {
    const sameRange = view.rangePresetDays === null
        ? settings.rangePresetDays === null && view.startsOn === settings.startsOn && view.endsOn === settings.endsOn
        : view.rangePresetDays === settings.rangePresetDays;

    return sameRange
        && view.currency === settings.currency
        && view.accountKind === settings.accountKind
        && [...view.accountIds].sort().join() === [...settings.accountIds].sort().join()
        && view.granularity === settings.granularity
        && view.savingsMode === settings.savingsMode
        && view.chartView === settings.chartView
        && view.savingsSimulationId === settings.savingsSimulationId;
}

export function ForecastSavedViews(props: Props) {
    const isLoaded = props.views.some((view) => view.id === props.selection);
    return <ForecastSavedViewsPanel key={`${props.selection ?? "none"}:${isLoaded}`} {...props} />;
}

function ForecastSavedViewsPanel({ views, selection, settings, hasUnsavedSimulation, onSelectionChange }: Props) {
    const router = useRouter();
    const [isSaving, startSaving] = useTransition();
    const saved = views.find((view) => view.id === selection);
    const [name, setName] = useState(saved?.name ?? "");
    const [isDefault, setIsDefault] = useState(saved?.isDefault ?? false);
    const hasUnsavedChanges = selection === "new" || (saved !== undefined && (
        saved.name !== name.trim()
        || saved.isDefault !== isDefault
        || !sameSettings(saved, settings)
    ));

    function save() {
        startSaving(async () => {
            const result = await saveForecastView({
                ...settings,
                id: saved?.id,
                name: name.trim(),
                isDefault,
            });
            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            if (!saved) onSelectionChange(result.id ?? null);
            router.refresh();
        });
    }

    function remove() {
        if (!saved) return;
        const viewId = saved.id;

        startSaving(async () => {
            const result = await deleteForecastView(viewId);
            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onSelectionChange(null);
            router.refresh();
        });
    }

    return (
        <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                        <Bookmark className="size-5" />
                    </span>
                    <div>
                        <h2 className="font-semibold">Previsiones guardadas</h2>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                            Guarda el rango, la agrupación, los filtros, las vistas y la simulación de ahorro
                            para volver a ellos sin configurarlos otra vez.
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-2 md:w-72">
                    <FormLabel>Previsión</FormLabel>
                    <FormSelect
                        value={selection ?? "none"}
                        onValueChange={(next) => onSelectionChange(next === "none" ? null : next)}
                        options={[
                            { value: "none", label: "Ninguna · configuración por defecto" },
                            ...views.map((view) => ({
                                value: view.id,
                                label: view.isDefault ? `${view.name} · predeterminada` : view.name,
                            })),
                            { value: "new", label: "Guardar la configuración actual" },
                        ]}
                    />
                </div>
            </div>

            {selection !== null && (
                <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-end">
                    <div className="flex flex-1 flex-col gap-2">
                        <FormLabel htmlFor="forecast-view-name">Nombre</FormLabel>
                        <FormInput
                            id="forecast-view-name"
                            value={name}
                            maxLength={80}
                            placeholder="Ej. Quincena de noviembre"
                            onChange={(event) => setName(event.target.value)}
                        />
                        {hasUnsavedSimulation && (
                            <p className="text-xs text-muted-foreground">
                                La simulación de ahorro automático no está guardada; guárdala para incluirla.
                            </p>
                        )}
                    </div>
                    <label className="flex h-12 cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                            checked={isDefault}
                            onCheckedChange={(checked) => setIsDefault(checked === true)}
                        />
                        Abrirla al entrar a Previsión
                    </label>
                    <div className="flex gap-2">
                        {saved && (
                            <Button
                                type="button"
                                variant="outline"
                                size="lg"
                                disabled={isSaving}
                                onClick={remove}
                                className="cursor-pointer"
                            >
                                <Trash2 />
                                Eliminar
                            </Button>
                        )}
                        <Button
                            type="button"
                            size="lg"
                            disabled={isSaving || !hasUnsavedChanges || !name.trim()}
                            onClick={save}
                            className="cursor-pointer"
                        >
                            <Save />
                            {isSaving ? "Guardando..." : saved ? "Guardar cambios" : "Guardar"}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}
