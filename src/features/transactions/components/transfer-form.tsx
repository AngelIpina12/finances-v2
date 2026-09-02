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
} from "@/src/shared/components/forms";
import { fromAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";
import { createTransfer } from "../actions/transaction-actions";
import { transferFormSchema, type TransferFormData } from "../schemas/transfer.schema";
import { createTransferDraft } from "../utils/transfer-draft";

type AccountOption = {
    id: string;
    name: string;
    type: string;
    currency: "MXN" | "USD" | "EUR" | "GBP";
};

interface Props {
    accounts: AccountOption[];
    onClose: () => void;
}

export function TransferForm({ accounts, onClose }: Props) {
    const [isPending, startTransition] = useTransition();
    const {
        register, control, handleSubmit,
        setValue, formState: { errors }
    } = useForm<TransferFormData>({
        resolver: zodResolver(transferFormSchema) as Resolver<TransferFormData>,
        defaultValues: createTransferDraft(accounts),
        mode: "all",
    });
    const sourceAccountId = useWatch({ control, name: "sourceAccountId" });
    const sourceAccount = accounts.find((account) => account.id === sourceAccountId);
    const destinationAccounts = useMemo(
        () => accounts.filter(
            (account) => account.id !== sourceAccountId
                && (!sourceAccount || account.currency === sourceAccount.currency),
        ),
        [accounts, sourceAccount, sourceAccountId],
    );

    function onSubmit(data: TransferFormData) {
        startTransition(async () => {
            const result = await createTransfer(data);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onClose();
        });
    }

    const accountOptions = (options: AccountOption[]) => options.map((account) => ({
        value: account.id,
        label: `${account.name} · ${account.currency}`,
    }));

    return (
        <Form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="sourceAccountId">Desde</FormLabel>
                    <Controller
                        name="sourceAccountId"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={field.value}
                                onValueChange={(value) => {
                                    field.onChange(value);
                                    const source = accounts.find((account) => account.id === value);
                                    const destination = accounts.find(
                                        (account) => account.id !== value
                                            && account.currency === source?.currency,
                                    );
                                    setValue("destinationAccountId", destination?.id ?? "", {
                                        shouldDirty: true,
                                        shouldValidate: false,
                                    });
                                }}
                                placeholder="Cuenta de origen"
                                options={accountOptions(accounts)}
                            />
                        )}
                    />
                    {errors.sourceAccountId && (
                        <FormError>{errors.sourceAccountId.message}</FormError>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="destinationAccountId">Hacia</FormLabel>
                    <Controller
                        name="destinationAccountId"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Cuenta de destino"
                                options={accountOptions(destinationAccounts)}
                            />
                        )}
                    />
                    {errors.destinationAccountId && (
                        <FormError>{errors.destinationAccountId.message}</FormError>
                    )}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="transfer-amount">Monto</FormLabel>
                    <FormInput
                        id="transfer-amount"
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
                    <FormLabel htmlFor="transfer-date">Fecha y hora</FormLabel>
                    <FormInput
                        id="transfer-date"
                        type="datetime-local"
                        {...register("date", {
                            setValueAs: fromAppDateTimeInputValue,
                        })}
                    />
                    {errors.date && <FormError>{errors.date.message}</FormError>}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="transfer-description">
                    Descripción
                    <span className="font-normal text-muted-foreground">(opcional)</span>
                </FormLabel>
                <FormInput
                    id="transfer-description"
                    placeholder="Ej. Pago de tarjeta"
                    {...register("description")}
                />
                {errors.description && <FormError>{errors.description.message}</FormError>}
            </div>

            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="transfer-notes">
                    Notas <span className="font-normal text-muted-foreground">(opcional)</span>
                </FormLabel>
                <textarea
                    id="transfer-notes"
                    className="min-h-20 w-full rounded-xl border bg-card p-3 text-sm"
                    {...register("notes")}
                />
                {errors.notes && <FormError>{errors.notes.message}</FormError>}
            </div>

            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                Se registrará una salida y una entrada vinculadas. No contará como ingreso ni gasto.
            </p>

            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancelar
                </Button>
                <FormSubmit disabled={isPending || accounts.length < 2}>
                    {isPending ? "Transfiriendo..." : "Realizar transferencia"}
                </FormSubmit>
            </div>
        </Form>
    );
}
