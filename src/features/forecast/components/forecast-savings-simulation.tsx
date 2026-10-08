"use client";

import { useTransition } from "react";
import toast from "react-hot-toast";
import {
    Plus, Save, Trash2,
    X
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    FormInput, FormLabel, FormSelect
} from "@/src/shared/components/forms";
import { deleteSavingsSimulation, saveSavingsSimulation } from "../actions/savings-simulation-actions";
import type { LinkedSavings } from "../domain/linked-savings";
import { getSweepableSavings, type SavingsSweepRule } from "../domain/savings-sweep";
import { formatMoney } from "./forecast-ui";

export type SavingsSimulationDraft = {
    id?: string;
    name: string;
    rules: SavingsSweepRule[];
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


export function ForecastSavingsSimulation({
    accounts, linkedSavings, simulations,
    value, onChange
}: Props) {
    const router = useRouter();
    const [isSaving, startSaving] = useTransition();
    const eligibleAccounts = accounts.filter((account) => getSweepableSavings(linkedSavings, account.id).length > 0);

    if (!eligibleAccounts.length) return null;

    const saved = simulations.find((simulation) => simulation.id === value?.id);
    const hasUnsavedChanges = value !== null && (!saved
        || saved.name !== value.name.trim()
        || saved.isDefault !== value.isDefault
        || JSON.stringify(saved.rules) !== JSON.stringify(value.rules));
    const usedAccountIds = new Set(value?.rules.map((rule) => rule.accountId));
    const nextAccount = eligibleAccounts.find((account) => !usedAccountIds.has(account.id));

    function ruleFor(accountId: string): SavingsSweepRule {
        return { accountId, positionId: getSweepableSavings(linkedSavings, accountId)[0]?.positionId ?? "", minimumBalance: 0 };
    }

    function selectSimulation(next: string) {
        if (next === "none") return onChange(null);
        if (next === "new") {
            return onChange({ name: "", rules: [ruleFor(eligibleAccounts[0].id)], isDefault: false });
        }

        const simulation = simulations.find((item) => item.id === next);
        if (simulation) onChange({ ...simulation, rules: simulation.rules.map((rule) => ({ ...rule })) });
    }

    function updateRule(index: number, rule: SavingsSweepRule) {
        if (!value) return;
        onChange({ ...value, rules: value.rules.map((current, position) => position === index ? rule : current) });
    }

    function removeRule(index: number) {
        if (!value) return;
        onChange({ ...value, rules: value.rules.filter((_, position) => position !== index) });
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
                    <div className="space-y-3">
                        {value.rules.map((rule, index) => {
                            const accountSavings = getSweepableSavings(linkedSavings, rule.accountId);
                            const account = accounts.find((item) => item.id === rule.accountId);

                            return (
                                <div
                                    key={rule.accountId}
                                    className="grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem_auto] md:items-end"
                                >
                                    <div className="flex flex-col gap-2">
                                        <FormLabel>Cuenta</FormLabel>
                                        <FormSelect
                                            value={rule.accountId}
                                            onValueChange={(accountId) => updateRule(index, ruleFor(accountId))}
                                            options={eligibleAccounts
                                                .filter((item) => item.id === rule.accountId || !usedAccountIds.has(item.id))
                                                .map((item) => ({ value: item.id, label: `${item.name} · ${item.currency}` }))}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <FormLabel>Cajita</FormLabel>
                                        <FormSelect
                                            value={rule.positionId}
                                            onValueChange={(positionId) => updateRule(index, { ...rule, positionId })}
                                            options={accountSavings.map((saving) => ({
                                                value: saving.positionId,
                                                label: `${saving.name} · ${formatMoney(saving.balance, saving.currency)} · ${(saving.annualRate * 100).toFixed(2)}%`,
                                            }))}
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <FormLabel htmlFor={`simulation-minimum-${rule.accountId}`}>Saldo mínimo</FormLabel>
                                        <FormInput
                                            id={`simulation-minimum-${rule.accountId}`}
                                            type="number"
                                            inputMode="decimal"
                                            min={0}
                                            step="0.01"
                                            placeholder="0"
                                            title={`Se queda en ${account?.name ?? "la cuenta"}; sólo lo que exceda se va a la cajita.`}
                                            value={rule.minimumBalance || ""}
                                            onChange={(event) => updateRule(index, {
                                                ...rule,
                                                minimumBalance: event.target.value === "" ? 0 : Number(event.target.value),
                                            })}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-lg"
                                        disabled={value.rules.length === 1}
                                        onClick={() => removeRule(index)}
                                        className="cursor-pointer"
                                        aria-label={`Quitar ${account?.name ?? "cuenta"}`}
                                    >
                                        <X />
                                    </Button>
                                </div>
                            );
                        })}
                        {nextAccount && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onChange({ ...value, rules: [...value.rules, ruleFor(nextAccount.id)] })}
                                className="cursor-pointer"
                            >
                                <Plus />
                                Agregar cuenta
                            </Button>
                        )}
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
