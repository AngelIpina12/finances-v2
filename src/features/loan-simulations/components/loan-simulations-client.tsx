"use client";

import {
    useMemo, useState, useTransition
} from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
    Calculator, Copy, Download,
    Pencil, Plus, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/src/shared/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CardTitle } from "@/src/shared/components/ui/card";
import { cn } from "@/lib/utils";
import { deleteLoanSimulation } from "../actions/loan-simulation-actions";
import { buildAmortizationSchedule } from "../domain/amortization-calculator";
import type { LoanSimulationItem, LoanSimulationsData } from "../queries/get-loan-simulations-data";
import { toLoanSimulationDraft } from "../utils/loan-simulation-draft";
import { AmortizationTable, amortizationCsv } from "./amortization-table";
import { formatLoanDate, formatMoney, formatPercent } from "./loan-format";
import { LoanSimulationForm } from "./loan-simulation-form";

type Editing = { mode: "new" } | { mode: "edit" | "copy"; simulation: LoanSimulationItem };

export function LoanSimulationsClient({ simulations }: LoanSimulationsData) {
    const router = useRouter();
    const [selectedId, setSelectedId] = useState<string | null>(simulations[0]?.id ?? null);
    const [editing, setEditing] = useState<Editing | null>(null);
    const [simulationToDelete, setSimulationToDelete] = useState<LoanSimulationItem | null>(null);
    const [isPending, startTransition] = useTransition();
    const schedules = useMemo(() => new Map(simulations.map((simulation) => [
        simulation.id,
        buildAmortizationSchedule(simulation.terms),
    ])), [simulations]);
    const selected = simulations.find((simulation) => simulation.id === selectedId) ?? simulations[0];
    const selectedSchedule = selected ? schedules.get(selected.id) : undefined;

    function remove() {
        if (!simulationToDelete) return;
        startTransition(async () => {
            const result = await deleteLoanSimulation(simulationToDelete.id);
            if (!result.success) {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            setSimulationToDelete(null);
            router.refresh();
        });
    }

    function exportCsv() {
        if (!selected || !selectedSchedule) return;
        const blob = new Blob([`﻿${amortizationCsv(selectedSchedule)}`], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${selected.name.replace(/[^\p{L}\p{N}-]+/gu, "_")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    }

    return (
        <div className="space-y-7">
            <motion.header
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
            >
                <div className="space-y-2">
                    <p className="font-label text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground">
                        Cotiza antes de firmar
                    </p>
                    <CardTitle className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">
                        Simulador de créditos
                    </CardTitle>
                    <p className="max-w-2xl text-muted-foreground">
                        Captura los datos de una cotización y obtén su tabla de amortización. Las
                        simulaciones no crean movimientos ni afectan tus saldos.
                    </p>
                </div>
                <Button size="lg" onClick={() => setEditing({ mode: "new" })} className="cursor-pointer">
                    <Plus />
                    Nueva simulación
                </Button>
            </motion.header>

            {!selected || !selectedSchedule ? (
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.16 }}
                    className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-muted/25 p-8 text-center"
                >
                    <div className="max-w-md">
                        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                            <Calculator />
                        </span>
                        <h2 className="mt-5 text-xl font-semibold">Simula tu primer crédito</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Precio, enganche, tasa, plazo, comisión y seguros: con eso calculamos cuánto
                            pagarías cada mes y cuánto te cuesta el crédito.
                        </p>
                        <Button className="mt-5 cursor-pointer" onClick={() => setEditing({ mode: "new" })}>
                            <Plus />
                            Crear simulación
                        </Button>
                    </div>
                </motion.section>
            ) : (
                <>
                    <motion.section layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        <AnimatePresence mode="popLayout">
                            {simulations.map((simulation, index) => {
                                const { summary } = schedules.get(simulation.id)!;
                                const isSelected = simulation.id === selected.id;
                                return (
                                    <motion.button
                                        layout
                                        type="button"
                                        key={simulation.id}
                                        initial={{ opacity: 0, y: 18 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.96 }}
                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                        onClick={() => setSelectedId(simulation.id)}
                                        aria-pressed={isSelected}
                                        className={cn(
                                            "cursor-pointer rounded-2xl border bg-card p-5 text-left shadow-sm transition-shadow hover:shadow-lg",
                                            isSelected && "border-primary ring-2 ring-primary/30",
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <h2 className="font-semibold">{simulation.name}</h2>
                                            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                                {simulation.terms.rateType === "msi"
                                                    ? `${simulation.terms.termMonths} MSI`
                                                    : `${formatPercent(summary.annualRateWithVatPercent)} · ${simulation.terms.termMonths} m`}
                                            </span>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-3">
                                            <Metric label="Mensualidad" value={formatMoney(summary.firstPayment, simulation.currency)} />
                                            <Metric label="Total a pagar" value={formatMoney(summary.totalPaid, simulation.currency)} />
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </AnimatePresence>
                    </motion.section>

                    <motion.section
                        key={selected.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="space-y-5 rounded-2xl border bg-card p-5 shadow-sm"
                    >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="font-serif text-2xl">{selected.name}</h2>
                                {selected.notes && <p className="mt-1 text-sm text-muted-foreground">{selected.notes}</p>}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" onClick={() => setEditing({ mode: "edit", simulation: selected })} className="cursor-pointer">
                                    <Pencil />
                                    Editar
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditing({ mode: "copy", simulation: selected })} className="cursor-pointer">
                                    <Copy />
                                    Duplicar
                                </Button>
                                <Button size="sm" variant="outline" onClick={exportCsv} className="cursor-pointer">
                                    <Download />
                                    CSV
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSimulationToDelete(selected)}
                                    aria-label={`Eliminar ${selected.name}`}
                                    className="cursor-pointer text-destructive hover:text-destructive"
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        </div>

                        <SummaryGrid simulation={selected} summary={selectedSchedule.summary} />
                        <AmortizationTable {...selectedSchedule} />
                        <p className="text-xs text-muted-foreground">
                            Estimado con anualidad fija sobre la tasa con IVA. El banco puede usar otra base
                            de días, redondeos o reglas de seguros; compáralo contra la tabla oficial.
                        </p>
                    </motion.section>
                </>
            )}

            <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent
                    className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-none overflow-y-auto p-6 sm:w-[min(92vw,48rem)] sm:max-w-none"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="font-serif text-2xl">
                                    {editing?.mode === "edit" ? "Editar simulación" : "Nueva simulación de crédito"}
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    Copia los datos de la cotización; la vista previa se actualiza mientras escribes.
                                </DialogDescription>
                            </div>
                            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setEditing(null)} className="cursor-pointer">
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    {editing && (
                        <LoanSimulationForm
                            key={editing.mode === "new" ? "new" : `${editing.mode}-${editing.simulation.id}`}
                            initialValues={editing.mode === "new" ? undefined : toLoanSimulationDraft(editing.simulation, editing.mode === "copy")}
                            simulationId={editing.mode === "edit" ? editing.simulation.id : undefined}
                            onClose={(savedId) => {
                                setEditing(null);
                                if (savedId) setSelectedId(savedId);
                                router.refresh();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={simulationToDelete !== null} onOpenChange={(open) => !open && setSimulationToDelete(null)}>
                <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-destructive/10 text-destructive">
                            <Trash2 />
                        </AlertDialogMedia>
                        <AlertDialogTitle>¿Eliminar esta simulación?</AlertDialogTitle>
                        <AlertDialogDescription className="min-w-0 wrap-break-word">
                            {simulationToDelete ? `“${simulationToDelete.name}” se eliminará de forma permanente.` : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:flex-col">
                        <AlertDialogCancel className="w-full cursor-pointer" disabled={isPending}>
                            Conservar
                        </AlertDialogCancel>
                        <AlertDialogAction variant="destructive" disabled={isPending} onClick={remove} className="w-full cursor-pointer">
                            {isPending ? "Eliminando..." : "Eliminar simulación"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function SummaryGrid({ simulation, summary }: {
    simulation: LoanSimulationItem;
    summary: ReturnType<typeof buildAmortizationSchedule>["summary"];
}) {
    const money = (value: number) => formatMoney(value, simulation.currency);
    const items = [
        { label: "Pago inicial", value: money(summary.initialPayment), hint: `Enganche ${money(summary.downPayment)}${summary.openingFee ? ` · comisión ${money(summary.openingFee)}` : ""}` },
        { label: "Monto a financiar", value: money(summary.financedTotal), hint: summary.financedInsurance ? `Incluye seguro ${money(summary.financedInsurance)}` : undefined },
        { label: "Mensualidad", value: money(summary.firstPayment), hint: summary.maxPayment !== summary.firstPayment ? `Máxima ${money(summary.maxPayment)}` : undefined },
        { label: "Total a pagar", value: money(summary.totalPaid), hint: "Pago inicial + mensualidades" },
        { label: "Intereses + IVA", value: money(summary.totalInterest) },
        { label: "Costo financiero", value: money(summary.financialCost), hint: "Intereses, comisión y seguro de vida" },
        {
            label: "Costo anual efectivo",
            value: summary.effectiveAnnualCost === null ? "—" : formatPercent(summary.effectiveAnnualCost * 100),
            hint: simulation.terms.rateType === "msi" ? "Meses sin intereses" : `Tasa con IVA ${formatPercent(summary.annualRateWithVatPercent)}`,
        },
        { label: "Último pago", value: summary.lastPaymentDate ? formatLoanDate(summary.lastPaymentDate) : "—" },
    ];

    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
                <div key={item.label} className="rounded-xl bg-muted/50 p-4">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-lg font-semibold">{item.value}</p>
                    {item.hint && <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>}
                </div>
            ))}
        </div>
    );
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-medium">{value}</p>
        </div>
    );
}
