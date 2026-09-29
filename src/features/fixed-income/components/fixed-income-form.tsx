"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
    Controller, type Resolver, useForm,
    useWatch,
} from "react-hook-form";
import toast from "react-hot-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    DatePickerField,
    Form, FormError, FormInput,
    FormLabel, FormSelect, FormSubmit,
} from "@/src/shared/components/forms";
import {
    createFixedIncomePosition,
    updateFixedIncomePosition,
} from "../actions/fixed-income-actions";
import {
    calculateAccruedInterest, calculateNetInterest,
} from "../domain/fixed-income-calculator";
import type { FixedIncomeData } from "../queries/get-fixed-income-data";
import {
    fixedIncomePositionSchema, type FixedIncomePositionData,
} from "../schemas/fixed-income.schema";
import { createFixedIncomeDraft } from "../utils/fixed-income-draft";
import { addAppCalendarDays, toAppDateInputValue } from "@/src/shared/utils/local-date-time";

type Props = {
    accounts: FixedIncomeData["liquidAccounts"];
    initialValues?: FixedIncomePositionData;
    onClose: () => void;
    positionId?: string;
};

const money = (amount: number, currency: string) => new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
}).format(amount);

export function FixedIncomeForm({ accounts, initialValues, onClose, positionId }: Props) {
    const [isPending, startTransition] = useTransition();
    const isEditing = Boolean(positionId);
    const [hasMaturity, setHasMaturity] = useState(Boolean(initialValues?.maturesAt));

    const {
        register, control, handleSubmit, setValue,
        formState: { errors },
    } = useForm<FixedIncomePositionData>({
        resolver: zodResolver(fixedIncomePositionSchema) as Resolver<FixedIncomePositionData>,
        defaultValues: initialValues ?? createFixedIncomeDraft(accounts),
        mode: "all",
    });
    const values = useWatch({ control });
    const preview = values.startsAt && values.maturesAt && values.principal && values.annualRate !== undefined
        ? calculateAccruedInterest({
            principal: Number(values.principal),
            annualRate: Number(values.annualRate),
            startsAt: new Date(values.startsAt),
            asOf: new Date(values.maturesAt),
            calculationMethod: values.calculationMethod || "simple",
            dayCountConvention: values.dayCountConvention || "actual_365",
        })
        : { days: 0, gross: 0 };
    const net = calculateNetInterest(preview.gross, Number(values.withholdingRate || 0));
    const source = accounts.find((account) => account.id === values.fundingAccountId);
    const matchingAccounts = accounts.filter((account) => (
        !source || account.currency === source.currency
    ));

    function submit(data: FixedIncomePositionData) {
        startTransition(async () => {
            const result = positionId
                ? await updateFixedIncomePosition(positionId, data)
                : await createFixedIncomePosition(data);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onClose();
        });
    }

    function accountLabel(account: FixedIncomeData["liquidAccounts"][number]) {
        return `${account.name} · ${account.currency} · ${money(account.currentBalance, account.currency)}`;
    }

    return (
        <Form onSubmit={handleSubmit(submit)}>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" error={errors.name?.message} htmlFor="fi-name">
                    <FormInput
                        id="fi-name"
                        placeholder="Ej. CETE 28 días"
                        {...register("name")}
                    />
                </Field>
                <Field label="Institución" error={errors.institution?.message} htmlFor="fi-institution">
                    <FormInput
                        id="fi-institution"
                        placeholder="Ej. Cetesdirecto"
                        {...register("institution")}
                    />
                </Field>
            </div>

            <Field label="Cuenta de fondeo" error={errors.fundingAccountId?.message}>
                <Controller
                    name="fundingAccountId"
                    control={control}
                    render={({ field }) => (
                        <FormSelect
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Elige de dónde sale el capital"
                            options={accounts.map((account) => ({
                                value: account.id,
                                label: accountLabel(account),
                            }))}
                            disabled={isEditing}
                        />
                    )}
                />
            </Field>

            <Field label="Cuenta que recibe intereses y retiros" error={errors.settlementAccountId?.message}>
                <Controller
                    name="settlementAccountId"
                    control={control}
                    render={({ field }) => (
                        <FormSelect
                            name={field.name}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Elige dónde recibirás el dinero"
                            options={matchingAccounts.map((account) => ({
                                value: account.id,
                                label: accountLabel(account),
                            }))}
                        />
                    )}
                />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Capital" error={errors.principal?.message} htmlFor="fi-principal">
                    <FormInput
                        id="fi-principal"
                        type="number"
                        min="0.01"
                        step="0.01"
                        {...register("principal")}
                        disabled={isEditing}
                    />
                </Field>
                <Field label="Tasa anual nominal" error={errors.annualRate?.message} htmlFor="fi-rate">
                    <FormInput
                        id="fi-rate"
                        type="number"
                        min="0"
                        step="0.0001"
                        {...register("annualRate")}
                        disabled={isEditing}
                    />
                    <p className="text-xs text-muted-foreground">0.10 equivale a 10% anual.</p>
                </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Método">
                    <Controller
                        name="calculationMethod"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isEditing}
                                options={[
                                    { value: "simple", label: "Simple" },
                                    { value: "compound", label: "Compuesto" },
                                ]}
                            />
                        )}
                    />
                </Field>
                <Field label="Base anual">
                    <Controller
                        name="dayCountConvention"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isEditing}
                                options={[
                                    { value: "actual_360", label: "Actual / 360" },
                                    { value: "actual_365", label: "Actual / 365" },
                                ]}
                            />
                        )}
                    />
                </Field>
                <Field label="Pago de interés" error={errors.interestFrequency?.message}>
                    <Controller
                        name="interestFrequency"
                        control={control}
                        render={({ field }) => (
                            <FormSelect
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                                disabled={isEditing}
                                options={[
                                    { value: "daily", label: "Diario (manual)" },
                                    { value: "monthly", label: "Mensual" },
                                    { value: "at_maturity", label: "Al vencimiento" },
                                ]}
                            />
                        )}
                    />
                </Field>
            </div>

            <Controller
                name="isAvailableOnDemand"
                control={control}
                render={({ field }) => (
                    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50">
                        <span>
                            <span className="block text-sm font-medium">Cajita disponible al instante</span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                                Incluye este capital en tu liquidez. Podrás retirarlo a la cuenta elegida
                                cuando lo necesites, sin esperar al vencimiento.
                            </span>
                        </span>
                        <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="cursor-pointer"
                        />
                    </label>
                )}
            />

            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50">
                <span>
                    <span className="block text-sm font-medium">Tiene fecha de vencimiento</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                        Desactívalo para una cajita indefinida; podrás retirar el capital cuando quieras.
                    </span>
                </span>
                <Switch
                    checked={hasMaturity}
                    onCheckedChange={(checked) => {
                        setHasMaturity(checked);
                        setValue(
                            "maturesAt",
                            checked
                                ? toAppDateInputValue(addAppCalendarDays(new Date(), 30)) as unknown as Date
                                : undefined,
                            { shouldValidate: true },
                        );
                    }}
                    className="cursor-pointer"
                />
            </label>

            <motion.div
                layout
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`grid gap-4 ${hasMaturity ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
            >
                <Field label="Inicio" error={errors.startsAt?.message} htmlFor="fi-start">
                    <Controller
                        name="startsAt"
                        control={control}
                        render={({ field }) => (
                            <DatePickerField
                                id="fi-start"
                                value={field.value ? new Date(field.value) : undefined}
                                onChange={field.onChange}
                                disabled={isEditing}
                            />
                        )}
                    />
                </Field>
                {hasMaturity && (
                    <Field label="Vencimiento" error={errors.maturesAt?.message} htmlFor="fi-matures">
                        <Controller
                            name="maturesAt"
                            control={control}
                            render={({ field }) => (
                                <DatePickerField
                                    id="fi-matures"
                                    value={field.value ? new Date(field.value) : undefined}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </Field>
                )}
                <Field label="Retención" htmlFor="fi-tax">
                    <FormInput
                        id="fi-tax"
                        type="number"
                        min="0"
                        max="1"
                        step="0.0001"
                        {...register("withholdingRate")}
                    />
                    <p className="text-xs text-muted-foreground">0.10 equivale a 10%.</p>
                </Field>
            </motion.div>

            <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                {hasMaturity
                    ? <>Vista previa: {preview.days} días · interés bruto {preview.gross.toFixed(2)}
                        {" · "}retención {net.tax.toFixed(2)} · neto {net.net.toFixed(2)}
                        {" · "}valor estimado {(Number(values.principal || 0) + net.net).toFixed(2)}.</>
                    : "Cajita indefinida: el rendimiento se calcula diariamente con la tasa anual y sólo se vuelve ingreso al confirmar el abono."}
            </p>

            {isEditing && (
                <p className="text-xs text-muted-foreground">
                    El capital, cuenta de fondeo, tasa y fecha de inicio se conservan para no alterar
                    los movimientos ya registrados.
                </p>
            )}

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
                    {isPending ? (isEditing ? "Guardando..." : "Creando...") : (isEditing ? "Guardar cambios" : "Crear inversión")}
                </FormSubmit>
            </div>
        </Form>
    );
}

function Field({
    children,
    error,
    htmlFor,
    label,
}: {
    children: React.ReactNode;
    error?: string;
    htmlFor?: string;
    label: string;
}) {
    return (
        <div className="flex flex-col gap-2">
            <FormLabel htmlFor={htmlFor}>{label}</FormLabel>
            {children}
            {error && <FormError>{error}</FormError>}
        </div>
    );
}
