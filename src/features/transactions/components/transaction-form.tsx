"use client";

import { useMemo, useTransition } from "react";
import {
    Controller, Resolver, useForm,
    useWatch
} from "react-hook-form";
import toast from "react-hot-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
    Form, FormError, FormInput,
    FormLabel, FormSelect, FormSubmit,
    SegmentedControl,
} from "@/src/shared/components/forms";
import { createTransaction } from "../actions/transaction-actions";
import { TransactionFormData, transactionFormSchema } from "../schemas/transaction.schema";
import { createTransactionDraft } from "../utils/transaction-draft";
import { fromLocalDateTimeInputValue } from "@/src/shared/utils/local-date-time";

type AccountOption = {
    id: string;
    name: string;
    type: string;
    currency: "MXN" | "USD" | "EUR" | "GBP";
};

type CategoryOption = {
    id: string;
    name: string;
    type: "income" | "expense" | "transfer";
    color: string | null;
};

interface Props {
    accounts: AccountOption[];
    categories: CategoryOption[];
    onClose: () => void;
}

export function TransactionForm({ accounts, categories, onClose }: Props) {
    const [isPending, startTransition] = useTransition();

    const {
        register, handleSubmit, formState: { errors },
        control, setValue, clearErrors
    } = useForm<TransactionFormData>({
        resolver: zodResolver(transactionFormSchema) as Resolver<TransactionFormData>,
        defaultValues: createTransactionDraft(accounts),
        mode: "all",
    });
    const transactionType = useWatch({ control, name: "type" });

    const matchingCategories = useMemo(
        () => categories.filter((category) => category.type === transactionType),
        [categories, transactionType],
    );

    function changeType(nextType: "income" | "expense") {
        setValue("type", nextType, { shouldDirty: true });
        setValue("categoryId", "", { shouldDirty: true, shouldValidate: false, shouldTouch: false });
        clearErrors("categoryId");
    }

    function onSubmit(data: TransactionFormData) {
        startTransition(async () => {
            const result = await createTransaction(data);

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
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="accountId">Cuenta</FormLabel>
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
                    <FormLabel htmlFor="categoryId">Categoría</FormLabel>
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
                    <FormLabel htmlFor="amount">Monto</FormLabel>
                    <FormInput
                        id="amount"
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
                    <FormLabel htmlFor="date">Fecha y hora</FormLabel>
                    <FormInput
                        id="date"
                        type="datetime-local"
                        {...register("date", {
                            setValueAs: fromLocalDateTimeInputValue,
                        })}
                    />
                    {errors.date && <FormError>{errors.date.message}</FormError>}
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="merchant">
                    Comercio o descripción
                    <span className="font-normal text-muted-foreground">
                        (opcional)
                    </span>
                </FormLabel>
                <FormInput
                    id="merchant"
                    placeholder={transactionType === "expense" ? "Ej. Supermercado" : "Ej. Nómina"}
                    {...register("merchant")}
                />
                {errors.merchant && <FormError>{errors.merchant.message}</FormError>}
            </div>
            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="notes">
                    Notas <span className="font-normal text-muted-foreground">(opcional)</span>
                </FormLabel>
                <textarea
                    id="notes"
                    className="min-h-20 w-full rounded-xl border bg-card p-3 text-sm"
                    {...register("notes")}
                />
                {errors.notes && <FormError>{errors.notes.message}</FormError>}
            </div>
            <div className="flex justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="h-12 cursor-pointer"
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
                    {isPending ? "Guardando..." : "Guardar movimiento"}
                </FormSubmit>
            </div>
        </Form>
    );
}
