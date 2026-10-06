"use client";

import { useState } from "react";
import { PiggyBank, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { FormSelect, SegmentedControl } from "@/src/shared/components/forms";
import type { LinkedSavings, LinkedSavingsMode } from "../domain/linked-savings";
import { getSweepableSavings } from "../domain/savings-sweep";
import {
    ForecastSavingsSimulation, type SavedSavingsSimulation, type SavingsSimulationDraft,
} from "./forecast-savings-simulation";

export const SAVINGS_MODE_LABELS: Record<LinkedSavingsMode, string> = {
    exclude: "Sin cajitas",
    principal: "Con cajitas",
    with_yield: "Con rendimiento",
};

const SAVINGS_MODE_DESCRIPTIONS: Record<LinkedSavingsMode, string> = {
    exclude: "Las cuentas muestran sólo su propio saldo; lo guardado en cajitas no se contempla.",
    principal: "Cada cajita aparece como su propia cuenta con su saldo actual, sin rendimiento futuro. La gráfica suma la vista Cajitas.",
    with_yield: "Cada cajita aparece como su propia cuenta y genera su rendimiento diario estimado. La gráfica suma las vistas Cajitas y Rendimientos.",
};

interface Props {
    savingsMode: LinkedSavingsMode;
    onSavingsModeChange: (mode: LinkedSavingsMode) => void;
    accounts: Array<{ id: string; name: string; currency: string }>;
    linkedSavings: LinkedSavings[];
    simulations: SavedSavingsSimulation[];
    simulation: SavingsSimulationDraft | null;
    onSimulationChange: (simulation: SavingsSimulationDraft | null) => void;
}

type FieldsProps = Pick<Props, "savingsMode" | "onSavingsModeChange" | "accounts" | "linkedSavings" | "simulations" | "simulation" | "onSimulationChange"> & {
    onEditSimulation: () => void;
};

export function canSimulateSavings(accounts: Props["accounts"], linkedSavings: LinkedSavings[]) {
    return accounts.some((account) => getSweepableSavings(linkedSavings, account.id).length > 0);
}

export function ForecastSavingsFields({
    savingsMode, onSavingsModeChange, accounts, linkedSavings,
    simulations, simulation, onSimulationChange, onEditSimulation,
}: FieldsProps) {
    function selectSimulation(next: string) {
        if (next === "none") return onSimulationChange(null);
        const saved = simulations.find((item) => item.id === next);
        if (saved) onSimulationChange({ ...saved });
    }

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Cajitas</p>
                <SegmentedControl
                    items={["exclude", "principal", "with_yield"] as const}
                    labels={SAVINGS_MODE_LABELS}
                    value={savingsMode}
                    onChange={onSavingsModeChange}
                    className="mb-0 [&>button]:px-2 [&>button]:whitespace-nowrap max-sm:[&>button]:text-xs"
                />
                <p className="text-xs text-muted-foreground">{SAVINGS_MODE_DESCRIPTIONS[savingsMode]}</p>
            </div>

            {canSimulateSavings(accounts, linkedSavings) && (
                <div className="space-y-2 border-t pt-4">
                    <p className="text-xs font-medium text-muted-foreground">Ahorro automático</p>
                    <FormSelect
                        value={simulation ? simulation.id ?? "draft" : "none"}
                        onValueChange={selectSimulation}
                        className="data-[size=default]:h-10"
                        options={[
                            { value: "none", label: "Sin simulación" },
                            ...simulations.map((item) => ({ value: item.id, label: item.name })),
                            ...(simulation && !simulation.id
                                ? [{ value: "draft", label: simulation.name.trim() || "Simulación sin guardar" }]
                                : []),
                        ]}
                    />
                    <Button type="button" variant="outline" onClick={onEditSimulation} className="w-full cursor-pointer">
                        <Settings2 />
                        {simulation ? "Editar simulación" : "Crear simulación"}
                    </Button>
                </div>
            )}
        </div>
    );
}

export function ForecastSavingsPopover(props: FieldsProps) {
    const [open, setOpen] = useState(false);
    const isActive = props.savingsMode !== "exclude" || props.simulation !== null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
                render={<Button variant={isActive ? "secondary" : "ghost"} className="shrink-0 cursor-pointer" />}
            >
                <PiggyBank className={props.simulation ? "text-primary" : "text-muted-foreground"} />
                Ahorro
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[26rem] p-4">
                <ForecastSavingsFields
                    {...props}
                    onEditSimulation={() => {
                        setOpen(false);
                        props.onEditSimulation();
                    }}
                />
            </PopoverContent>
        </Popover>
    );
}

export function ForecastSimulationDialog({ open, onOpenChange, ...props }: Pick<Props, "accounts" | "linkedSavings" | "simulations" | "simulation" | "onSimulationChange"> & {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Ahorro automático</DialogTitle>
                    <DialogDescription>
                        Simula que cada ingreso de una cuenta se va a una de sus cajitas y que, antes de cada
                        pago, se retira de la cajita lo que haga falta. No modifica tus cuentas reales.
                    </DialogDescription>
                </DialogHeader>
                <ForecastSavingsSimulation
                    accounts={props.accounts}
                    linkedSavings={props.linkedSavings}
                    simulations={props.simulations}
                    value={props.simulation}
                    onChange={props.onSimulationChange}
                />
            </DialogContent>
        </Dialog>
    );
}
