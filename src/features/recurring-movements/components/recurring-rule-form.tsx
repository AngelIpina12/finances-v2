"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useTransition } from "react";
import {
    Controller, type Resolver, useForm,
    useWatch
} from "react-hook-form";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    Form, FormError, FormInput,
    FormLabel, FormSelect, FormSubmit,
    SegmentedControl,
} from "@/src/shared/components/forms";
import { fromAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";
import { saveRecurringRule } from "../actions/recurring-rule-actions";
import { recurringRuleFormSchema, type RecurringRuleFormData } from "../schemas/recurring-rule.schema";
import { createRecurringRuleDraft } from "../utils/recurring-rule-draft";

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

const frequencyOptions = [
    { value: "weekly", label: "Cada semana" },
    { value: "biweekly", label: "Cada 14 días" },
    { value: "monthly", label: "Cada mes" },
    { value: "yearly", label: "Cada año" },
];

interface Props {
    accounts: AccountOption[];
    categories: CategoryOption[];
    initialValues?: Partial<RecurringRuleFormData>;
    onClose: () => void;
}

export function RecurringRuleForm({ accounts, categories, initialValues, onClose }: Props) {
    const [isPending, startTransition] = useTransition();
    const {
        register, control, handleSubmit,
        setValue, clearErrors, formState: { errors },
    } = useForm<RecurringRuleFormData>({
        resolver: zodResolver(recurringRuleFormSchema) as Resolver<RecurringRuleFormData>,
        defaultValues: initialValues ?? createRecurringRuleDraft(accounts),
        mode: "all",
    });
    const transactionType = useWatch({ control, name: "transactionType" });
    const matchingCategories = useMemo(
        () => categories.filter((category) => category.type === transactionType),
        [categories, transactionType],
    );

    function changeType(nextType: "income" | "expense") {
        setValue("transactionType", nextType, { shouldDirty: true });
        setValue("categoryId", "", { shouldDirty: true, shouldValidate: false });
        clearErrors("categoryId");
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
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="recurring-account">Cuenta</FormLabel>
                    <Controller
                        name="accountId"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Selecciona una cuenta"
                                options={accounts.map((account) => ({
                                    value: account.id,
                                    label: `${account.name} · ${account.currency}`,
                                }))}
                            />
                        )}
                    />
                    {errors.accountId && <FormError>{errors.accountId.message}</FormError>}
                </div>
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="recurring-category">Categoría</FormLabel>
                    <Controller
                        name="categoryId"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Selecciona una categoría"
                                options={matchingCategories.map((category) => ({
                                    value: category.id,
                                    label: category.name,
                                }))}
                            />
                        )}
                    />
                    {errors.categoryId && <FormError>{errors.categoryId.message}</FormError>}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="recurring-amount">Monto</FormLabel>
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
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="recurring-frequency">Frecuencia</FormLabel>
                    <Controller
                        name="frequency"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Selecciona una frecuencia"
                                options={frequencyOptions}
                            />
                        )}
                    />
                    {errors.frequency && <FormError>{errors.frequency.message}</FormError>}
                </div>
            </div>

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
                    <FormLabel htmlFor="recurring-end">
                        Finaliza <span className="font-normal text-muted-foreground">(opcional)</span>
                    </FormLabel>
                    <FormInput
                        id="recurring-end"
                        type="datetime-local"
                        {...register("endsAt", { setValueAs: fromAppDateTimeInputValue })}
                    />
                    {errors.endsAt && <FormError>{errors.endsAt.message}</FormError>}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="recurring-notes">
                    Notas <span className="font-normal text-muted-foreground">(opcional)</span>
                </FormLabel>
                <textarea
                    id="recurring-notes"
                    className="min-h-20 w-full rounded-xl border bg-card p-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50"
                    placeholder="Agrega algún detalle útil"
                    {...register("notes")}
                />
                {errors.notes && <FormError>{errors.notes.message}</FormError>}
            </div>

            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                Crearemos las próximas fechas dentro de una ventana de 60 días. Puedes
                pausarla cuando quieras; las ocurrencias ya creadas se conservan.
            </p>

            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
                    Cancelar
                </Button>
                <FormSubmit disabled={isPending || !accounts.length || !matchingCategories.length}>
                    {isPending ? "Guardando..." : initialValues?.id ? "Guardar cambios" : "Crear recurrencia"}
                </FormSubmit>
            </div>
        </Form>
    );
}
