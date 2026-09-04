"use client";

import {
    Controller, type Resolver, useForm,
    useWatch
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    Form, FormError, FormInput,
    FormLabel, FormSelect, FormSubmit,
} from "@/src/shared/components/forms";
import { fromAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";
import { createFinancingPlan } from "../actions/financing-actions";
import { financingPlanFormSchema, type FinancingPlanFormData } from "../schemas/financing.schema";
import type { FinancingData } from "../queries/get-financing-data";
import { createFinancingPlanDraft } from "../utils/financing-draft";

const money = (amount: number, currency: string) => new Intl.NumberFormat("es-MX", {
    style: "currency", currency, maximumFractionDigits: 2,
}).format(amount);

interface Props {
    purchases: FinancingData["purchases"];
    onClose: () => void;
}

export function FinancingPlanForm({ purchases, onClose }: Props) {
    const [isPending, startTransition] = useTransition();
    const {
        register, control, handleSubmit,
        formState: { errors },
    } = useForm<FinancingPlanFormData>({
        resolver: zodResolver(financingPlanFormSchema) as Resolver<FinancingPlanFormData>,
        defaultValues: createFinancingPlanDraft(purchases),
        mode: "all",
    });
    const purchaseId = useWatch({ control, name: "purchaseTransactionId" });
    const count = useWatch({ control, name: "regularInstallmentCount" });
    const installmentAmount = useWatch({ control, name: "regularInstallmentAmount" });
    const balloonAmount = useWatch({ control, name: "balloonAmount" });
    const selectedPurchase = purchases.find((purchase) => purchase.id === purchaseId);
    const configuredTotal = Number(count || 0) * Number(installmentAmount || 0) + Number(balloonAmount || 0);

    function onSubmit(data: FinancingPlanFormData) {
        startTransition(async () => {
            const result = await createFinancingPlan(data);

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
                <FormLabel>Compra de tarjeta</FormLabel>
                <Controller
                    name="purchaseTransactionId"
                    control={control}
                    render={({ field }) => (
                        <FormSelect
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Selecciona una compra"
                            options={purchases.map((purchase) => ({
                                value: purchase.id,
                                label: `${purchase.name || "Compra"} · ${money(purchase.amount, purchase.currency)} · ${purchase.accountName}`,
                            }))}
                        />
                    )}
                />
                {errors.purchaseTransactionId && <FormError>{errors.purchaseTransactionId.message}</FormError>}
            </div>

            <div className="flex flex-col gap-2">
                <FormLabel htmlFor="financing-name">Nombre</FormLabel>
                <FormInput
                    id="financing-name"
                    placeholder="Ej. Laptop"
                    {...register("name")}
                />
                {errors.name && <FormError>{errors.name.message}</FormError>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="financing-count">Cuotas regulares</FormLabel>
                    <FormInput
                        id="financing-count"
                        type="number"
                        min="1"
                        max="240"
                        {...register("regularInstallmentCount")}
                    />
                    {errors.regularInstallmentCount && (
                        <FormError>{errors.regularInstallmentCount.message}</FormError>
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="financing-amount">Monto por cuota</FormLabel>
                    <FormInput
                        id="financing-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        {...register("regularInstallmentAmount")}
                    />
                    {errors.regularInstallmentAmount && (
                        <FormError>{errors.regularInstallmentAmount.message}</FormError>
                    )}
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="financing-balloon">Pago final (opcional)</FormLabel>
                    <FormInput
                        id="financing-balloon"
                        type="number"
                        min="0"
                        step="0.01"
                        {...register("balloonAmount")}
                    />
                    {errors.balloonAmount && <FormError>{errors.balloonAmount.message}</FormError>}
                </div>
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="financing-start">Primer pago</FormLabel>
                    <FormInput
                        id="financing-start"
                        type="datetime-local"
                        {...register("startsAt", { setValueAs: fromAppDateTimeInputValue })}
                    />
                    {errors.startsAt && <FormError>{errors.startsAt.message}</FormError>}
                </div>
            </div>

            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                Compra: {selectedPurchase ? money(selectedPurchase.amount, selectedPurchase.currency) : "—"}
                {" · "}Calendario: {selectedPurchase ? money(configuredTotal, selectedPurchase.currency) : "—"}
                {selectedPurchase && Math.round(selectedPurchase.amount * 100) !== Math.round(configuredTotal * 100)
                    ? " · La suma debe coincidir exactamente." : ""}
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
                <FormSubmit disabled={isPending || !purchases.length}>
                    {isPending ? "Creando..." : "Crear financiamiento"}
                </FormSubmit>
            </div>
        </Form>
    );
}
