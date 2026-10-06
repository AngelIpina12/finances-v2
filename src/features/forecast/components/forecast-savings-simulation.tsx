"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import { Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    FormInput, FormLabel, FormSelect
} from "@/src/shared/components/forms";
import { deleteSavingsSimulation, saveSavingsSimulation } from "../actions/savings-simulation-actions";
import type { LinkedSavings } from "../domain/linked-savings";
import { getSweepableSavings } from "../domain/savings-sweep";
import { formatMoney } from "./forecast-ui";

export type SavingsSimulationDraft = {
    id?: string;
    name: string;
    accountId: string;
    positionId: string;
    minimumBalance: number;
    isDefault: boolean;
};

export type SavedSavingsSimulation = Required<SavingsSimulationDraft>;

interface Props {
    accounts: Array<{ id: string; name: string; currency: string }>;
    linkedSavings: LinkedSavings[];
    simulations: SavedSavingsSimulation[];
    value: SavingsSimulationDraft | null;
    onChange: (value: SavingsSimulationDraft | null) => void;
}


export function ForecastSavingsSimulation({ accounts, linkedSavings, simulations, value, onChange }: Props) {
    const router = useRouter();
    const [isSaving, startSaving] = useTransition();
    const eligibleAccounts = accounts.filter((account) => getSweepableSavings(linkedSavings, account.id).length > 0);

    if (!eligibleAccounts.length) return null;

    const accountSavings = value ? getSweepableSavings(linkedSavings, value.accountId) : [];
    const selectedAccount = accounts.find((account) => account.id === value?.accountId);
    const saved = simulations.find((simulation) => simulation.id === value?.id);
    const hasUnsavedChanges = value !== null && (!saved
        || saved.name !== value.name.trim()
        || saved.accountId !== value.accountId
        || saved.positionId !== value.positionId
        || saved.minimumBalance !== value.minimumBalance
        || saved.isDefault !== value.isDefault);

    function selectSimulation(next: string) {
        if (next === "none") return onChange(null);
        if (next === "new") {
            const account = eligibleAccounts[0];
            return onChange({
                name: "",
                accountId: account.id,
                positionId: getSweepableSavings(linkedSavings, account.id)[0].positionId,
                minimumBalance: 0,
                isDefault: false,
            });
        }

        const simulation = simulations.find((item) => item.id === next);
        if (simulation) onChange({ ...simulation });
    }

    function selectAccount(accountId: string) {
        if (!value) return;
        onChange({ ...value, accountId, positionId: getSweepableSavings(linkedSavings, accountId)[0]?.positionId ?? "" });
    }

    function save() {
        if (!value) return;

        startSaving(async () => {
            const result = await saveSavingsSimulation({ ...value, name: value.name.trim() });
            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onChange({ ...value, id: result.id, name: value.name.trim() });
            router.refresh();
        });
    }

    function remove() {
        if (!value?.id) return;
        const simulationId = value.id;

        startSaving(async () => {
            const result = await deleteSavingsSimulation(simulationId);
            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onChange(null);
            router.refresh();
        });
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-col gap-3">
                <div className="flex w-full flex-col gap-2">
                    <FormLabel>Simulación</FormLabel>
                    <FormSelect
                        value={value ? value.id ?? "new" : "none"}
                        onValueChange={selectSimulation}
                        options={[
                            { value: "none", label: "Sin simulación" },
                            ...simulations.map((simulation) => ({
                                value: simulation.id,
                                label: simulation.isDefault ? `${simulation.name} · predeterminada` : simulation.name,
                            })),
                            { value: "new", label: "Nueva simulación" },
                        ]}
                    />
                </div>
            </div>

            {value && (
                <>
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <FormLabel>Cuenta que recibe los ingresos</FormLabel>
                            <FormSelect
                                value={value.accountId}
                                onValueChange={selectAccount}
                                options={eligibleAccounts.map((account) => ({
                                    value: account.id, label: `${account.name} · ${account.currency}`,
                                }))}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <FormLabel>Cajita destino</FormLabel>
                            <FormSelect
                                value={value.positionId}
                                onValueChange={(positionId) => onChange({ ...value, positionId })}
                                options={accountSavings.map((saving) => ({
                                    value: saving.positionId,
                                    label: `${saving.name} · ${formatMoney(saving.balance, saving.currency)} · ${(saving.annualRate * 100).toFixed(2)}%`,
                                }))}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <FormLabel htmlFor="simulation-minimum-balance">Saldo mínimo en la cuenta</FormLabel>
                            <FormInput
                                id="simulation-minimum-balance"
                                type="number"
                                inputMode="decimal"
                                min={0}
                                step="0.01"
                                placeholder="0"
                                value={value.minimumBalance || ""}
                                onChange={(event) => onChange({
                                    ...value,
                                    minimumBalance: event.target.value === "" ? 0 : Number(event.target.value),
                                })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Se queda en {selectedAccount?.name ?? "la cuenta"}; sólo lo que exceda se va a la cajita.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3 border-t pt-4 md:flex-row md:items-end">
                        <div className="flex flex-1 flex-col gap-2">
                            <FormLabel htmlFor="simulation-name">Nombre para guardarla</FormLabel>
                            <FormInput
                                id="simulation-name"
                                value={value.name}
                                maxLength={80}
                                placeholder="Ej. Nómina a cajita Nu"
                                onChange={(event) => onChange({ ...value, name: event.target.value })}
                            />
                        </div>
                        <label className="flex h-12 cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                                checked={value.isDefault}
                                onCheckedChange={(checked) => onChange({ ...value, isDefault: checked === true })}
                            />
                            Mostrarla al entrar a Previsión
                        </label>
                        <div className="flex gap-2">
                            {value.id && (
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
                                disabled={isSaving || !hasUnsavedChanges || !value.name.trim()}
                                onClick={save}
                                className="cursor-pointer"
                            >
                                <Save />
                                {isSaving ? "Guardando..." : value.id ? "Guardar cambios" : "Guardar"}
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
