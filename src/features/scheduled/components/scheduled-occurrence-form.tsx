"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useTransition } from "react";
import {
    Controller, type Resolver, useForm,
    useWatch,
} from "react-hook-form";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    Form, FormError, FormInput,
    FormLabel, FormSelect, FormSubmit,
    SegmentedControl,
} from "@/src/shared/components/forms";
import { fromAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";
import {
    getBalanceDelta, getCreditLimitImpact,
} from "@/src/features/transactions/domain/transaction-rules";
import { CreditLimitWarning } from "@/src/features/transactions/components/credit-limit-warning";
import { createScheduledOccurrence } from "../actions/scheduled-occurrence-actions";
import { scheduledOccurrenceFormSchema, type ScheduledOccurrenceFormData } from "../schemas/scheduled-occurrence.schema";
import { createScheduledOccurrenceDraft } from "../utils/scheduled-occurrence-draft";

type AccountOption = {
    id: string;
    name: string;
    type: "cash" | "debit" | "credit" | "wallet" | "investment" | "fixed_income" | "loan";
    currency: "MXN" | "USD" | "EUR" | "GBP";
    creditLimit: number | null;
    owedAmount: number | null;
    availableCredit: number | null;
};

type CategoryOption = {
    id: string;
    name: string;
    type: "income" | "expense" | "transfer";
};

interface Props {
    accounts: AccountOption[];
    categories: CategoryOption[];
    onClose: () => void;
}

export function ScheduledOccurrenceForm({ accounts, categories, onClose }: Props) {
    const [isPending, startTransition] = useTransition();
    const {
        register, control, handleSubmit,
        setValue, clearErrors, formState: { errors },
    } = useForm<ScheduledOccurrenceFormData>({
        resolver: zodResolver(scheduledOccurrenceFormSchema) as Resolver<ScheduledOccurrenceFormData>,
        defaultValues: createScheduledOccurrenceDraft(accounts),
        mode: "all",
    });
    const transactionType = useWatch({ control, name: "transactionType" });
    const accountId = useWatch({ control, name: "accountId" });
    const amount = useWatch({ control, name: "amount" });
    const matchingCategories = useMemo(
        () => categories.filter((category) => category.type === transactionType),
        [categories, transactionType],
    );
    const selectedAccount = accounts.find((account) => account.id === accountId);
    const creditImpact = selectedAccount && Number.isFinite(Number(amount))
        ? getCreditLimitImpact(
            selectedAccount,
            getBalanceDelta(selectedAccount, transactionType, Number(amount)),
        )
        : null;

    function changeType(nextType: "income" | "expense") {
        setValue("transactionType", nextType, { shouldDirty: true });
        setValue("categoryId", "", {
            shouldDirty: true,
            shouldTouch: false,
            shouldValidate: false,
        });
        clearErrors("categoryId");
    }

    function onSubmit(data: ScheduledOccurrenceFormData) {
        startTransition(async () => {
            const result = await createScheduledOccurrence(data);

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
                <FormLabel htmlFor="scheduled-name">Nombre</FormLabel>
                <FormInput
                    id="scheduled-name"
                    placeholder={transactionType === "income"
                        ? "Ej. Pago de nómina"
                        : "Ej. Renta del departamento"}
                    {...register("name")}
                />
                {errors.name && <FormError>{errors.name.message}</FormError>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="scheduled-account">Cuenta</FormLabel>
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
                    {errors.accountId && (
                        <FormError>{errors.accountId.message}</FormError>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="scheduled-category">Categoría</FormLabel>
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
                    {errors.categoryId && (
                        <FormError>{errors.categoryId.message}</FormError>
                    )}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="scheduled-amount">Monto</FormLabel>
                    <FormInput
                        id="scheduled-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        {...register("amount")}
                    />
                    {errors.amount && (
                        <FormError>{errors.amount.message}</FormError>
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="scheduled-date">Fecha y hora</FormLabel>
                    <FormInput
                        id="scheduled-date"
                        type="datetime-local"
                        {...register("scheduledAt", {
                            setValueAs: fromAppDateTimeInputValue,
                        })}
                    />
                    {errors.scheduledAt && (
                        <FormError>{errors.scheduledAt.message}</FormError>
                    )}
                </div>
            </div>

            {creditImpact && creditImpact.newlyOverLimit > 0 && selectedAccount && (
                <CreditLimitWarning
                    impact={creditImpact}
                    currency={selectedAccount.currency}
                    scheduled
                />
            )}

            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="scheduled-notes">
                    Notas
                    <span className="font-normal text-muted-foreground">
                        (opcional)
                    </span>
                </FormLabel>
                <textarea
                    id="scheduled-notes"
                    className="min-h-24 w-full rounded-xl border bg-card p-3 text-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring/50"
                    placeholder="Agrega contexto para reconocerlo después"
                    {...register("notes")}
                />
                {errors.notes && <FormError>{errors.notes.message}</FormError>}
            </div>

            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                Programarlo no modificará tu saldo. El movimiento se registrará
                cuando lo marques como completado.
            </p>

            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="cursor-pointer"
                >
                    Cancelar
                </Button>
                <FormSubmit
                    disabled={
                        isPending
                        || !accounts.length
                        || !matchingCategories.length
                    }
                >
                    {isPending ? "Programando..." : "Programar movimiento"}
                </FormSubmit>
            </div>
        </Form>
    );
}
