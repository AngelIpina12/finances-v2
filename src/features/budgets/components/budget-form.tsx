"use client";

import { useTransition } from "react";
import {
    Controller, type Resolver, useFieldArray,
    useForm, useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    Form, FormError, FormInput,
    FormLabel, FormSelect, FormSubmit,
} from "@/src/shared/components/forms";
import { fromAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";
import { saveBudget } from "../actions/budget-actions";
import type { BudgetsData } from "../queries/get-budgets";
import { budgetFormSchema, type BudgetFormData } from "../schemas/budget.schema";

const budgetColors = [
    "#2563eb", "#7c3aed", "#db2777", "#ea580c",
    "#ca8a04", "#059669", "#0f172a",
] as const;

const colorLabels: Record<(typeof budgetColors)[number], string> = {
    "#2563eb": "Azul océano",
    "#7c3aed": "Violeta nocturno",
    "#db2777": "Rosa intenso",
    "#ea580c": "Naranja cálido",
    "#ca8a04": "Ámbar",
    "#059669": "Verde esmeralda",
    "#0f172a": "Grafito",
};

function money(amount: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
    }).format(amount);
}

interface Props {
    initialValues: BudgetFormData;
    categories: BudgetsData["categories"];
    onClose: () => void;
}

export function BudgetForm({ initialValues, categories, onClose }: Props) {
    const [isPending, startTransition] = useTransition();
    const {
        register, control, handleSubmit,
        setValue, formState: { errors },
    } = useForm<BudgetFormData>({
        resolver: zodResolver(budgetFormSchema) as Resolver<BudgetFormData>,
        defaultValues: initialValues,
        mode: "all",
    });
    const { fields, append, remove } = useFieldArray({ control, name: "allocations" });
    const period = useWatch({ control, name: "period" });
    const color = useWatch({ control, name: "color" });
    const budgetAmount = Number(useWatch({ control, name: "amount" }) || 0);
    const currency = useWatch({ control, name: "currency" });
    const allocations = useWatch({ control, name: "allocations" }) ?? [];
    const allocatedAmount = allocations.reduce(
        (total, allocation) => total + Number(allocation.amount || 0),
        0,
    );
    const allocationRemaining = budgetAmount - allocatedAmount;
    const allocationsExceedBudget = allocationRemaining < -0.00001;

    function onSubmit(data: BudgetFormData) {
        startTransition(async () => {
            const result = await saveBudget(data);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onClose();
        });
    }

    function onInvalid() {
        if (allocationsExceedBudget) {
            toast.error("Las asignaciones superan el límite del presupuesto.");
        }
    }

    return (
        <Form onSubmit={handleSubmit(onSubmit, onInvalid)}>
            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="budget-name">Nombre</FormLabel>
                <FormInput
                    id="budget-name"
                    autoFocus
                    placeholder="Ej. Gastos esenciales"
                    {...register("name")}
                />
                {errors.name && <FormError>{errors.name.message}</FormError>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="budget-amount">Límite</FormLabel>
                    <FormInput
                        id="budget-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        {...register("amount")}
                    />
                    {errors.amount && <FormError>{errors.amount.message}</FormError>}
                </div>
                <div className="flex flex-col gap-2">
                    <FormLabel>Moneda</FormLabel>
                    <Controller
                        name="currency"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                options={["MXN", "USD", "EUR", "GBP"].map((currency) => ({
                                    value: currency,
                                    label: currency,
                                }))}
                            />
                        )} />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel>Periodo</FormLabel>
                    <Controller
                        name="period"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                options={[
                                    { value: "weekly", label: "Semanal" },
                                    { value: "monthly", label: "Mensual" },
                                    { value: "quarterly", label: "Trimestral" },
                                    { value: "yearly", label: "Anual" },
                                    { value: "custom", label: "Personalizado" },
                                ]}
                            />
                        )} />
                </div>
                <div className="flex flex-col gap-2">
                    <FormLabel>Rollover</FormLabel>
                    <Controller
                        name="rollover"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                options={[
                                    { value: "disabled", label: "Sin rollover" },
                                    { value: "carry_remaining", label: "Acumular sobrante" },
                                    { value: "carry_deficit", label: "Arrastrar excedente" },
                                ]}
                            />
                        )} />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="budget-start">Inicio</FormLabel>
                    <FormInput
                        id="budget-start"
                        type="datetime-local"
                        {...register("startsAt", { setValueAs: fromAppDateTimeInputValue })}
                    />
                </div>
                {period === "custom" && (
                    <div className="flex flex-col gap-2">
                        <FormLabel htmlFor="budget-end">Fin</FormLabel>
                        <FormInput
                            id="budget-end"
                            type="datetime-local"
                            {...register("endsAt", { setValueAs: fromAppDateTimeInputValue })}
                        />
                        {errors.endsAt && <FormError>{errors.endsAt.message}</FormError>}
                    </div>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="budget-threshold">Alerta (%)</FormLabel>
                    <FormInput
                        id="budget-threshold"
                        type="number"
                        min="1"
                        max="100"
                        {...register("warningThreshold")}
                    />
                </div>
                <div className="space-y-3">
                    <div>
                        <FormLabel>Color del presupuesto</FormLabel>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {colorLabels[color as keyof typeof colorLabels] ?? "Color personalizado"} es el color seleccionado.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {budgetColors.map((option) => (
                            <Button
                                key={option}
                                type="button"
                                aria-label={`Elegir ${colorLabels[option]}`}
                                title={colorLabels[option]}
                                onClick={() => setValue("color", option, { shouldDirty: true, shouldValidate: true })}
                                className={`size-8 cursor-pointer rounded-full ring-offset-2 transition ${color === option
                                    ? "ring-2 ring-foreground"
                                    : "hover:scale-110"}`
                                }
                                style={{ backgroundColor: option }}
                            />
                        ))}
                        <label
                            className="relative size-8 cursor-pointer rounded-full bg-[conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#8b5cf6,#ec4899,#ef4444)] shadow-sm transition hover:scale-110"
                            title="Elegir un color personalizado"
                        >
                            <FormInput
                                type="color"
                                className="absolute inset-0 cursor-pointer opacity-0"
                                aria-label="Elegir un color personalizado"
                                {...register("color")}
                            />
                        </label>
                    </div>
                    {errors.color && <FormError>{errors.color.message}</FormError>}
                </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
                <FormInput
                    type="checkbox"
                    className="size-4 cursor-pointer accent-primary"
                    {...register("isReusable")}
                />
                Crear periodos futuros automáticamente
            </label>

            <div className="space-y-3 rounded-xl border p-3">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium">
                            Categorías asignadas
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Vacío = presupuesto global. Puedes dejar una parte sin asignar.
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => append({ categoryId: categories[0]?.id ?? "", amount: 0 })}
                        disabled={!categories.length}
                    >
                        <Plus /> Agregar
                    </Button>
                </div>
                {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[1fr_7rem_auto] gap-2">
                        <Controller
                            name={`allocations.${index}.categoryId`}
                            control={control}
                            render={({ field: allocation }) => (
                                <FormSelect
                                    name={allocation.name}
                                    value={allocation.value}
                                    onValueChange={allocation.onChange}
                                    options={categories.map((category) => ({
                                        value: category.id,
                                        label: category.name,
                                    }))}
                                />
                            )} />
                        <FormInput
                            type="number"
                            min="0.01"
                            step="0.01"
                            aria-label="Monto asignado"
                            {...register(`allocations.${index}.amount`)}
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="cursor-pointer"
                            onClick={() => remove(index)}
                        >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Quitar</span>
                        </Button>
                    </div>
                ))}
                <div
                    aria-live="polite"
                    className={`rounded-lg px-3 py-2 text-xs ${allocationsExceedBudget
                        ? "bg-destructive/10 text-destructive"
                        : "bg-muted/60 text-muted-foreground"}`}
                >
                    <span className="font-medium">
                        Asignado: {money(allocatedAmount, currency)}
                    </span>
                    {" · "}
                    {allocationsExceedBudget
                        ? `Excedes el límite por ${money(Math.abs(allocationRemaining), currency)}.`
                        : `Te quedan ${money(allocationRemaining, currency)} por asignar.`}
                </div>
                {errors.allocations?.message && <FormError>{errors.allocations.message}</FormError>}
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button
                    type="button"
                    variant="outline"
                    className="cursor-pointer"
                    onClick={onClose}
                >
                    Cancelar
                </Button>
                <FormSubmit disabled={isPending || allocationsExceedBudget}>
                    {isPending
                        ? "Guardando..."
                        : initialValues.id
                            ? "Guardar cambios"
                            : "Crear presupuesto"}
                </FormSubmit>
            </div>
        </Form>
    );
}
