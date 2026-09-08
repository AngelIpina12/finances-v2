"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
    Controller, type Resolver, useForm,
    useWatch
} from "react-hook-form";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    Form, FormError, FormInput,
    FormLabel, FormSelect, FormSubmit,
    SegmentedControl,
} from "@/src/shared/components/forms";
import { getNextPaymentDueAt } from "@/src/features/forecast/domain/credit-card-cycle";
import type { ForecastData } from "@/src/features/forecast/queries/get-forecast-data";
import { saveCreditCardPaymentSettings } from "../actions/credit-card-payment-settings-actions";
import { creditCardPaymentSettingsSchema, type CreditCardPaymentSettingsFormData } from "../schemas/credit-card-payment-settings.schema";
import { createCreditCardPaymentSettingsDraft } from "../utils/credit-card-payment-settings-draft";

type Props = {
    card: ForecastData["accounts"][number];
    accounts: ForecastData["accounts"];
    setting: ForecastData["cardPaymentSettings"][number] | undefined;
    now: Date;
    onClose: () => void;
};

const days = Array.from({ length: 31 }, (_, index) => index + 1);

export function CreditCardPaymentSettingsForm({ card, accounts, setting, now, onClose }: Props) {
    const [isPending, startTransition] = useTransition();
    const {
        control, handleSubmit, register, setValue,
        formState: { errors },
    } = useForm<CreditCardPaymentSettingsFormData>({
        resolver: zodResolver(creditCardPaymentSettingsSchema) as Resolver<CreditCardPaymentSettingsFormData>,
        defaultValues: createCreditCardPaymentSettingsDraft({
            creditAccountId: card.id,
            billingDate: card.billingDate,
            statementBalance: card.statementBalance,
            minimumPayment: card.minimumPayment,
            setting,
        }),
        mode: "all",
    });
    const strategy = useWatch({ control, name: "strategy" });
    const billingDate = useWatch({ control, name: "billingDate" });
    const paymentTermDays = useWatch({ control, name: "paymentTermDays" });
    const paymentAccounts = accounts.filter((account) => (
        account.id !== card.id
        && account.currency === card.currency
        && account.type !== "credit"
        && account.includeInLiquidity
    ));
    const dueAt = Number.isInteger(billingDate) && Number.isInteger(paymentTermDays)
        ? getNextPaymentDueAt(now, billingDate, paymentTermDays)
        : null;

    function onSubmit(data: CreditCardPaymentSettingsFormData) {
        startTransition(async () => {
            const result = await saveCreditCardPaymentSettings(data);
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
                <FormLabel>Cuenta prevista de pago</FormLabel>
                <Controller
                    name="sourceAccountId"
                    control={control}
                    render={({ field }) => (
                        <FormSelect
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Selecciona una cuenta líquida"
                            options={paymentAccounts.map((account) => ({
                                value: account.id,
                                label: `${account.name} · ${account.currency}`,
                            }))}
                        />
                    )}
                />
                {errors.sourceAccountId && <FormError>{errors.sourceAccountId.message}</FormError>}
            </div>

            <SegmentedControl
                items={["full_statement", "minimum_payment", "fixed_amount", "manual"] as const}
                labels={{
                    full_statement: "Saldo total",
                    minimum_payment: "Mínimo",
                    fixed_amount: "Monto fijo",
                    manual: "Manual",
                }}
                value={strategy}
                onChange={(value) => setValue("strategy", value, { shouldDirty: true })}
            />

            {strategy === "fixed_amount" && (
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="fixed-amount">Monto fijo por pago</FormLabel>
                    <FormInput
                        id="fixed-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        {...register("fixedAmount")}
                    />
                    {errors.fixedAmount && <FormError>{errors.fixedAmount.message}</FormError>}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel>Día de corte</FormLabel>
                    <Controller
                        name="billingDate"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={String(field.value)}
                                onValueChange={(value) => field.onChange(Number(value))}
                                options={days.map((day) => ({ value: String(day), label: String(day) }))}
                            />
                        )}
                    />
                    {errors.billingDate && <FormError>{errors.billingDate.message}</FormError>}
                </div>
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="payment-term-days">Días naturales para pagar</FormLabel>
                    <FormInput
                        id="payment-term-days"
                        type="number"
                        min="1"
                        max="90"
                        {...register("paymentTermDays")}
                    />
                    {errors.paymentTermDays && <FormError>{errors.paymentTermDays.message}</FormError>}
                </div>
            </div>

            <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
                Próximo vencimiento calculado: {dueAt
                    ? format(dueAt, "d 'de' MMMM 'de' yyyy", { locale: es })
                    : "—"
                }. Los días naturales incluyen fines de semana y festivos.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="statement-balance">Saldo del estado vigente</FormLabel>
                    <FormInput
                        id="statement-balance"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...register("statementBalance")}
                    />
                    {errors.statementBalance && <FormError>{errors.statementBalance.message}</FormError>}
                </div>
                <div className="flex flex-col gap-2">
                    <FormLabel htmlFor="minimum-payment">Pago mínimo vigente</FormLabel>
                    <FormInput
                        id="minimum-payment"
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        {...register("minimumPayment")}
                    />
                    {errors.minimumPayment && <FormError>{errors.minimumPayment.message}</FormError>}
                </div>
            </div>

            <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                <span>
                    <span className="block font-medium">Incluir en previsión</span>
                    <span className="text-xs text-muted-foreground">Genera pagos virtuales sin registrar transacciones reales.</span>
                </span>
                <FormInput
                    type="checkbox"
                    className="size-4 cursor-pointer accent-primary"
                    {...register("includeInForecast")}
                />
            </label>

            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
                    Cancelar
                </Button>
                <FormSubmit disabled={isPending || !paymentAccounts.length}>
                    {isPending ? "Guardando..." : "Guardar plan de pago"}
                </FormSubmit>
            </div>
        </Form>
    );
}
