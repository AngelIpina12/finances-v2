"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
    Bookmark, Check, ChevronDown, Pencil,
    Plus, RotateCcw, Save, Star, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogDescription,
    DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuGroup,
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormInput, FormLabel } from "@/src/shared/components/forms";
import { cn } from "@/lib/utils";
import { deleteForecastView, saveForecastView } from "../actions/forecast-view-actions";
import {
    isSameForecastViewSettings, type ForecastViewDraft, type SavedForecastView,
} from "../domain/forecast-view";

interface Props {
    views: SavedForecastView[];
    selection: string | null;
    draft: ForecastViewDraft;
    hasUnsavedSimulation: boolean;
    onSelect: (selection: string | null) => void;
}

type NameDialog = { mode: "create" | "rename"; name: string; isDefault: boolean };

export function ForecastViewMenu({ views, selection, draft, hasUnsavedSimulation, onSelect }: Props) {
    const router = useRouter();
    const [isSaving, startSaving] = useTransition();
    const [nameDialog, setNameDialog] = useState<NameDialog | null>(null);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const active = views.find((view) => view.id === selection);
    const hasChanges = active ? !isSameForecastViewSettings(active, draft) : true;

    function storedSettings(view: SavedForecastView) {
        return {
            ...view,
            startsOn: view.startsOn ?? draft.startsOn,
            endsOn: view.endsOn ?? draft.endsOn,
        };
    }

    function persist(input: Parameters<typeof saveForecastView>[0], onSuccess?: (id?: string) => void) {
        startSaving(async () => {
            const result = await saveForecastView(input);
            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onSuccess?.(result.id);
            router.refresh();
        });
    }

    function save() {
        if (!active) {
            setNameDialog({ mode: "create", name: "", isDefault: false });
            return;
        }
        persist({ ...draft, id: active.id, name: active.name, isDefault: active.isDefault });
    }

    function submitNameDialog() {
        if (!nameDialog) return;
        const name = nameDialog.name.trim();

        if (nameDialog.mode === "rename" && active) {
            persist({ ...storedSettings(active), name }, () => setNameDialog(null));
            return;
        }
        persist({ ...draft, name, isDefault: nameDialog.isDefault }, (id) => {
            setNameDialog(null);
            if (id) onSelect(id);
        });
    }

    function toggleDefault(view: SavedForecastView) {
        persist({ ...storedSettings(view), isDefault: !view.isDefault });
    }

    function remove() {
        if (!active) return;
        const viewId = active.id;

        startSaving(async () => {
            const result = await deleteForecastView(viewId);
            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            setIsConfirmingDelete(false);
            onSelect(null);
            router.refresh();
        });
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={(
                        <Button variant="outline" className="max-w-56 shrink-0 cursor-pointer font-medium">
                            {active?.isDefault
                                ? <Star className="fill-amber-400 text-amber-400" />
                                : <Bookmark className="text-muted-foreground" />}
                            <span className="truncate">{active?.name ?? "Previsión"}</span>
                            {active && hasChanges && (
                                <span aria-label="Cambios sin guardar" className="size-1.5 shrink-0 rounded-full bg-primary" />
                            )}
                            <ChevronDown className="text-muted-foreground" />
                        </Button>
                    )}
                />
                <DropdownMenuContent align="start" className="min-w-64">
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Previsiones guardadas</DropdownMenuLabel>
                        {views.length === 0 && (
                            <p className="px-2 py-1.5 text-xs text-muted-foreground">
                                Guarda la configuración actual para volver a ella después.
                            </p>
                        )}
                        {views.map((view) => (
                            <DropdownMenuItem key={view.id} onClick={() => onSelect(view.id)} className="cursor-pointer">
                                <Check className={cn(view.id === selection ? "opacity-100" : "opacity-0")} />
                                <span className="flex-1 truncate">{view.name}</span>
                                <button
                                    type="button"
                                    aria-label={view.isDefault ? "Dejar de abrirla al entrar" : "Abrirla al entrar"}
                                    disabled={isSaving}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        toggleDefault(view);
                                    }}
                                    className="-mr-1 grid size-6 cursor-pointer place-items-center rounded-md hover:bg-background"
                                >
                                    <Star className={view.isDefault ? "fill-amber-400 text-amber-400" : "text-muted-foreground"} />
                                </button>
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onSelect(null)} className="cursor-pointer">
                        <RotateCcw />
                        Ninguna · configuración por defecto
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={() => setNameDialog({ mode: "create", name: "", isDefault: false })}
                        className="cursor-pointer"
                    >
                        <Plus />
                        Guardar como nueva
                    </DropdownMenuItem>
                    {active && (
                        <>
                            <DropdownMenuItem
                                onClick={() => setNameDialog({ mode: "rename", name: active.name, isDefault: active.isDefault })}
                                className="cursor-pointer"
                            >
                                <Pencil />
                                Renombrar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setIsConfirmingDelete(true)}
                                className="cursor-pointer"
                            >
                                <Trash2 />
                                Eliminar
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <Button
                type="button"
                variant={hasChanges ? "default" : "ghost"}
                disabled={isSaving || !hasChanges}
                onClick={save}
                className="order-last ml-auto shrink-0 cursor-pointer"
            >
                {hasChanges ? <Save /> : <Check />}
                {isSaving ? "Guardando..." : hasChanges ? "Guardar" : "Guardada"}
            </Button>

            <Dialog open={nameDialog !== null} onOpenChange={(open) => !open && setNameDialog(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{nameDialog?.mode === "rename" ? "Renombrar previsión" : "Guardar previsión"}</DialogTitle>
                        <DialogDescription>
                            {nameDialog?.mode === "rename"
                                ? "Sólo cambia el nombre; la configuración guardada no se modifica."
                                : "Se guardan el rango, la agrupación, los filtros, las cajitas, la vista de la gráfica y la simulación de ahorro."}
                        </DialogDescription>
                    </DialogHeader>
                    {nameDialog && (
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                submitNameDialog();
                            }}
                            className="space-y-4"
                        >
                            <div className="flex flex-col gap-2">
                                <FormLabel htmlFor="forecast-view-name">Nombre</FormLabel>
                                <FormInput
                                    id="forecast-view-name"
                                    autoFocus
                                    value={nameDialog.name}
                                    maxLength={80}
                                    placeholder="Ej. Quincena de noviembre"
                                    onChange={(event) => setNameDialog({ ...nameDialog, name: event.target.value })}
                                />
                                {nameDialog.mode === "create" && hasUnsavedSimulation && (
                                    <p className="text-xs text-muted-foreground">
                                        La simulación de ahorro automático no está guardada; guárdala para incluirla.
                                    </p>
                                )}
                            </div>
                            {nameDialog.mode === "create" && (
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={nameDialog.isDefault}
                                        onCheckedChange={(checked) => setNameDialog({ ...nameDialog, isDefault: checked === true })}
                                    />
                                    Abrirla al entrar a Previsión
                                </label>
                            )}
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setNameDialog(null)} className="cursor-pointer">
                                    Cancelar
                                </Button>
                                <Button type="submit" disabled={isSaving || !nameDialog.name.trim()} className="cursor-pointer">
                                    {isSaving ? "Guardando..." : "Guardar"}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar «{active?.name}»?</AlertDialogTitle>
                        <AlertDialogDescription>
                            La previsión guardada desaparece; tus cuentas y simulaciones no cambian.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" disabled={isSaving} onClick={remove} className="cursor-pointer">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
