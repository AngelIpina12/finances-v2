"use client";

import {
    Controller, type Resolver, useForm
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    Form, FormError, FormLabel,
    FormSelect, FormSubmit
} from "@/src/shared/components/forms";
import { payFinancingInstallment } from "../actions/financing-actions";
import { completeFinancingInstallmentSchema, type CompleteFinancingInstallmentData } from "../schemas/financing.schema";
import type { FinancingData } from "../queries/get-financing-data";
import { createFinancingPaymentDraft } from "../utils/financing-draft";

interface Props {
    installmentId: string;
    accounts: FinancingData["paymentAccounts"];
    onClose: () => void;
}

export function FinancingPaymentForm({ installmentId, accounts, onClose }: Props) {
    const [isPending, startTransition] = useTransition();
    const {
        control, handleSubmit, formState: { errors }
    } = useForm<CompleteFinancingInstallmentData>({
        resolver: zodResolver(completeFinancingInstallmentSchema) as Resolver<CompleteFinancingInstallmentData>,
        defaultValues: createFinancingPaymentDraft(installmentId, accounts),
        mode: "all",
    });

    function onSubmit(data: CompleteFinancingInstallmentData) {
        startTransition(async () => {
            const result = await payFinancingInstallment(data);

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
            <div className="flex flex-col gap-2">
                <FormLabel>Cuenta desde la que pagas</FormLabel>
                <Controller
                    name="sourceAccountId"
                    control={control}
                    render={({ field }) => (
                        <FormSelect
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Cuenta de origen"
                            options={accounts.map((account) => ({
                                value: account.id,
                                label: `${account.name} · ${account.currency}`,
                            }))}
                        />
                    )}
                />
                {errors.sourceAccountId && (
                    <FormError>{errors.sourceAccountId.message}</FormError>
                )}
            </div>
            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                Se registrará una transferencia hacia la tarjeta. No se creará un gasto adicional.
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
                <FormSubmit disabled={isPending || !accounts.length}>
                    {isPending ? "Registrando..." : "Registrar pago"}
                </FormSubmit>
            </div>
        </Form>
    );
}
