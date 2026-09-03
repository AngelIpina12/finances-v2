"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
    CalendarPlus, Plus, Trash2
} from "lucide-react";
import { useMemo, useTransition } from "react";
import {
    Controller, type Resolver, useFieldArray,
    useForm, useWatch,
} from "react-hook-form";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    Form, FormError, FormInput, FormLabel,
    FormSelect, FormSubmit, SegmentedControl,
} from "@/src/shared/components/forms";
import { fromAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";
import { saveRecurringRule } from "../actions/recurring-rule-actions";
import { recurringRuleFormSchema, type RecurringRuleFormData } from "../schemas/recurring-rule.schema";
import { createRecurringRuleDraft } from "../utils/recurring-rule-draft";

const frequencyOptions = [
    { value: "weekly", label: "Cada semana" },
    { value: "biweekly", label: "Cada 14 días" },
    { value: "semimonthly", label: "Dos veces al mes" },
    { value: "monthly", label: "Cada mes" },
    { value: "yearly", label: "Cada año" },
    { value: "custom", label: "Calendario personalizado" },
];

const dayOptions = [
    ...Array.from({ length: 31 }, (_, index) => ({
        value: String(index + 1),
        label: `Día ${index + 1}`,
    })),
    { value: "0", label: "Último día del mes" },
];

type AccountOption = {
    id: string;
    name: string;
    currency: "MXN" | "USD" | "EUR" | "GBP";
};

type CategoryOption = {
    id: string;
    name: string;
    type: "income" | "expense" | "transfer";
};

interface RecurringRuleFormProps {
    accounts: AccountOption[];
    categories: CategoryOption[];
    initialValues?: Partial<RecurringRuleFormData>;
    onClose: () => void;
}

interface FieldSelectProps {
    label: string;
    name: "accountId" | "categoryId" | "frequency" | "amountStrategy" | "fifthOccurrencePolicy" | "semimonthlyFirstDay" | "semimonthlySecondDay";
    control: ReturnType<typeof useForm<RecurringRuleFormData>>["control"];
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
    error?: string;
}

export function RecurringRuleForm({ accounts, categories, initialValues, onClose }: RecurringRuleFormProps) {
    const [isPending, startTransition] = useTransition();
    const {
        register, control, handleSubmit,
        setValue, clearErrors, formState: { errors },
    } = useForm<RecurringRuleFormData>({
        resolver: zodResolver(recurringRuleFormSchema) as Resolver<RecurringRuleFormData>,
        defaultValues: initialValues ?? createRecurringRuleDraft(accounts),
        mode: "all",
    });
    const calendarEntries = useFieldArray({ control, name: "calendarEntries" });
    const dateOverrides = useFieldArray({ control, name: "dateOverrides" });
    const transactionType = useWatch({ control, name: "transactionType" });
    const frequency = useWatch({ control, name: "frequency" });
    const amountStrategy = useWatch({ control, name: "amountStrategy" });
    const fifthPolicy = useWatch({ control, name: "fifthOccurrencePolicy" });
    const matchingCategories = useMemo(
        () => categories.filter((category) => category.type === transactionType),
        [categories, transactionType],
    );

    function changeType(nextType: "income" | "expense") {
        setValue("transactionType", nextType, { shouldDirty: true });
        setValue("categoryId", "", { shouldDirty: true, shouldValidate: false });
        clearErrors("categoryId");
    }

    function applySalaryPreset() {
        setValue("transactionType", "income", { shouldDirty: true });
        setValue("categoryId", "", { shouldDirty: true, shouldValidate: false });
        clearErrors("categoryId");
        setValue("name", "Pago de nómina", { shouldDirty: true });
        setValue("frequency", "weekly", { shouldDirty: true });
        setValue("amountStrategy", "fixed", { shouldDirty: true });
        setValue("fifthOccurrencePolicy", "keep_fixed", { shouldDirty: true });
    }

    function onSubmit(data: RecurringRuleFormData) {
        startTransition(async () => {
            const result = await saveRecurringRule(data);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onClose();
        });
    }

    return (
        <Form onSubmit={handleSubmit(onSubmit)}>
            <SegmentedControl
                items={["expense", "income"] as const}
                labels={{ expense: "Gasto", income: "Ingreso" }}
                value={transactionType}
                onChange={changeType}
            />

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-muted/30 p-3">
                <p className="mr-auto text-xs text-muted-foreground">¿Configuras un salario?</p>
                <Button type="button" size="sm" variant="outline" onClick={applySalaryPreset} className="cursor-pointer">
                    <CalendarPlus />
                    Usar preset de salario
                </Button>
            </div>

            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="recurring-name">Nombre</FormLabel>
                <FormInput
                    id="recurring-name"
                    placeholder={transactionType === "income" ? "Ej. Pago de nómina" : "Ej. Netflix"}
                    {...register("name")}
                />
                {errors.name && <FormError>{errors.name.message}</FormError>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <FieldSelect
                    label="Cuenta"
                    name="accountId"
                    control={control}
                    options={accounts.map((account) => ({
                        value: account.id,
                        label: `${account.name} · ${account.currency}`,
                    }))}
                    placeholder="Selecciona una cuenta"
                    error={errors.accountId?.message}
                />
                <FieldSelect
                    label="Categoría"
                    name="categoryId"
                    control={control}
                    options={matchingCategories.map((category) => ({
                        value: category.id,
                        label: category.name,
                    }))}
                    placeholder="Selecciona una categoría"
                    error={errors.categoryId?.message}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="recurring-amount">Monto habitual</FormLabel>
                    <FormInput
                        id="recurring-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        {...register("amount")}
                    />
                    {errors.amount && <FormError>{errors.amount.message}</FormError>}
                </div>
                <FieldSelect
                    label="Frecuencia"
                    name="frequency"
                    control={control}
                    options={frequencyOptions}
                    error={errors.frequency?.message}
                />
            </div>

            {(frequency === "weekly" || frequency === "biweekly") && (
                <FieldSelect
                    label="Cómo calcular el monto"
                    name="amountStrategy"
                    control={control}
                    options={[
                        { value: "fixed", label: "Monto fijo por pago" },
                        { value: "period_total", label: "Distribuir total mensual" },
                        { value: "custom_per_occurrence", label: "Monto con excepciones" },
                    ]}
                    error={errors.amountStrategy?.message}
                />
            )}

            {amountStrategy === "period_total" && (
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="recurring-period-total">Total mensual</FormLabel>
                    <FormInput
                        id="recurring-period-total"
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        {...register("periodTotal")}
                    />
                    <p className="text-xs text-muted-foreground">
                        Se distribuye entre todas las fechas de ese mes, incluyendo meses con cinco pagos.
                    </p>
                    {errors.periodTotal && <FormError>{errors.periodTotal.message}</FormError>}
                </div>
            )}

            {frequency === "weekly" && amountStrategy !== "period_total" && (
                <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                    <FieldSelect
                        label="Si el mes tiene quinta fecha"
                        name="fifthOccurrencePolicy"
                        control={control}
                        options={[
                            { value: "keep_fixed", label: "Mantener monto habitual" },
                            { value: "custom_amount", label: "Usar monto diferente" },
                        ]}
                    />
                    {fifthPolicy === "custom_amount" && (
                        <div className="flex flex-col gap-2">
                            <FormLabel htmlFor="recurring-fifth-amount">Monto de la quinta fecha</FormLabel>
                            <FormInput
                                id="recurring-fifth-amount"
                                type="number"
                                min="0.01"
                                step="0.01"
                                inputMode="decimal"
                                placeholder="0.00"
                                {...register("fifthOccurrenceAmount")}
                            />
                            {errors.fifthOccurrenceAmount && <FormError>{errors.fifthOccurrenceAmount.message}</FormError>}
                        </div>
                    )}
                </div>
            )}

            {frequency === "semimonthly" && (
                <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-2">
                    <FieldSelect
                        label="Primera fecha mensual"
                        name="semimonthlyFirstDay"
                        control={control}
                        options={dayOptions.filter((option) => option.value !== "0")}
                        error={errors.semimonthlyFirstDay?.message}
                    />
                    <FieldSelect
                        label="Segunda fecha mensual"
                        name="semimonthlySecondDay"
                        control={control}
                        options={dayOptions}
                        error={errors.semimonthlySecondDay?.message}
                    />
                </div>
            )}

            {frequency === "custom" ? (
                <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
                    <div>
                        <p className="text-sm font-medium">Calendario personalizado</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Agrega todas las fechas conocidas. Cada una puede tener su propio monto.
                        </p>
                    </div>
                    {calendarEntries.fields.map((field, index) => (
                        <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_9rem_auto]">
                            <FormInput
                                type="datetime-local"
                                {...register(`calendarEntries.${index}.scheduledAt`, {
                                    setValueAs: fromAppDateTimeInputValue,
                                })}
                            />
                            <FormInput
                                type="number"
                                min="0.01"
                                step="0.01"
                                inputMode="decimal"
                                placeholder="Monto opcional"
                                {...register(`calendarEntries.${index}.amount`)}
                            />
                            <Button type="button" size="icon-sm" variant="ghost" onClick={() => calendarEntries.remove(index)} className="cursor-pointer">
                                <Trash2 />
                                <span className="sr-only">Eliminar fecha</span>
                            </Button>
                        </div>
                    ))}
                    {errors.calendarEntries?.message && <FormError>{errors.calendarEntries.message}</FormError>}
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => calendarEntries.append({ scheduledAt: undefined as unknown as Date, amount: undefined })}
                        className="cursor-pointer"
                    >
                        <Plus />
                        Agregar fecha
                    </Button>
                </section>
            ) : (
                <section className="space-y-3 rounded-xl border border-dashed bg-muted/15 p-4">
                    <div>
                        <p className="text-sm font-medium">Excepciones de calendario</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Cambia una fecha ya calculada —por ejemplo, febrero 22 en vez del 20— y, si quieres, su monto.
                        </p>
                    </div>
                    {dateOverrides.fields.map((field, index) => (
                        <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
                            <FormInput
                                type="datetime-local"
                                aria-label="Fecha original"
                                {...register(`dateOverrides.${index}.originalScheduledAt`, {
                                    setValueAs: fromAppDateTimeInputValue,
                                })}
                            />
                            <FormInput
                                type="datetime-local"
                                aria-label="Fecha nueva"
                                {...register(`dateOverrides.${index}.scheduledAt`, {
                                    setValueAs: fromAppDateTimeInputValue,
                                })}
                            />
                            <FormInput
                                type="number"
                                min="0.01"
                                step="0.01"
                                inputMode="decimal"
                                placeholder="Monto"
                                {...register(`dateOverrides.${index}.amount`)}
                            />
                            <Button type="button" size="icon-sm" variant="ghost" onClick={() => dateOverrides.remove(index)} className="cursor-pointer">
                                <Trash2 />
                                <span className="sr-only">Eliminar excepción</span>
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => dateOverrides.append({
                            originalScheduledAt: undefined as unknown as Date,
                            scheduledAt: undefined as unknown as Date,
                            amount: undefined,
                        })}
                        className="cursor-pointer"
                    >
                        <Plus />
                        Agregar excepción
                    </Button>
                </section>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="recurring-start">Inicio</FormLabel>
                    <FormInput
                        id="recurring-start"
                        type="datetime-local"
                        {...register("startsAt", { setValueAs: fromAppDateTimeInputValue })}
                    />
                    {errors.startsAt && <FormError>{errors.startsAt.message}</FormError>}
                </div>
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="recurring-end">Finaliza <span className="font-normal text-muted-foreground">(opcional)</span></FormLabel>
                    <FormInput
                        id="recurring-end"
                        type="datetime-local"
                        {...register("endsAt", { setValueAs: fromAppDateTimeInputValue })}
                    />
                    {errors.endsAt && <FormError>{errors.endsAt.message}</FormError>}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="recurring-notes">Notas <span className="font-normal text-muted-foreground">(opcional)</span></FormLabel>
                <textarea
                    id="recurring-notes"
                    className="min-h-20 w-full rounded-xl border bg-card p-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50"
                    placeholder="Agrega algún detalle útil"
                    {...register("notes")}
                />
                {errors.notes && <FormError>{errors.notes.message}</FormError>}
            </div>

            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                Las nuevas ocurrencias se calculan en CDMX y conservan su monto y fecha como snapshot al generarse.
            </p>

            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">Cancelar</Button>
                <FormSubmit disabled={isPending || !accounts.length || !matchingCategories.length}>
                    {isPending ? "Guardando..." : initialValues?.id ? "Guardar cambios" : "Crear recurrencia"}
                </FormSubmit>
            </div>
        </Form>
    );
}

function FieldSelect({ label, name, control, options, placeholder, error }: FieldSelectProps) {
    return (
        <div className="flex flex-col gap-2">
            <FormLabel>{label}</FormLabel>
            <Controller
                name={name}
                control={control}
                render={({ field }) => (
                    <FormSelect
                        name={field.name}
                        value={field.value === undefined ? "" : String(field.value)}
                        onValueChange={field.onChange}
                        placeholder={placeholder}
                        options={options}
                    />
                )}
            />
            {error && <FormError>{error}</FormError>}
        </div>
    );
}
