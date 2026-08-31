import { useTransition } from "react";
import {
    Controller, Resolver, useForm
} from "react-hook-form";
import toast from "react-hot-toast";
import {
    Form, FormError, FormInput,
    FormLabel, FormSelect, FormSubmit
} from "@/src/shared/components/forms";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/src/shared/components/ui/button";
import {
    accountColors, accountTypes, currencies,
    FinancialAccountFormData, financialAccountSchema, getAccountColorLabel,
} from "../schemas/financial-account.schema";
import { saveFinancialAccount } from "../actions/financial-account-actions";
import { AccountPlastic } from "./accounts-plastic";
import { ACCOUNT_TYPE_LABELS } from "../constants/account.constants";

interface Props {
    initialValues: FinancialAccountFormData;
    onClose: () => void;
}

export function AccountForm({ initialValues, onClose }: Props) {
    const [isPending, startTransition] = useTransition();
    const number = (value: string) => (value === "" ? undefined : Number(value));
    const days = Array.from({ length: 31 }, (_, index) => index + 1);

    const {
        register, handleSubmit, formState: { errors },
        control, setValue, watch
    } = useForm<FinancialAccountFormData>({
        resolver: zodResolver(financialAccountSchema) as Resolver<FinancialAccountFormData>,
        defaultValues: initialValues,
        mode: "all",
    });
    const values = watch();
    const credit = values.type === "credit";
    const card = values.type === "credit" || values.type === "debit";
    const availableCredit =
        credit && values.creditLimit !== undefined
            ? Math.max(0, values.creditLimit - (values.owedAmount ?? 0))
            : undefined;

    function handleTypeChange(type: FinancialAccountFormData["type"]) {
        if (type === "credit") {
            setValue("owedAmount", values.owedAmount ?? 0);
            return;
        }

        setValue("owedAmount", undefined);
        setValue("creditLimit", undefined);
        setValue("billingDate", undefined);
        setValue("dueDate", undefined);
    }

    function onSubmit(data: FinancialAccountFormData) {
        startTransition(async () => {
            const result = await saveFinancialAccount(data);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onClose();
        });
    }

    return (
        <Form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <FormLabel htmlFor="name">Nombre de la cuenta</FormLabel>
                        <FormInput
                            id="name"
                            placeholder="Ej. BBVA Nómina"
                            autoFocus
                            {...register("name")}
                        />
                        {errors.name && <FormError>{errors.name.message}</FormError>}
                    </div>
                    <div className="flex flex-col gap-2">
                        <FormLabel htmlFor="institution">Institución</FormLabel>
                        <FormInput
                            id="institution"
                            placeholder="Ej. BBVA"
                            {...register("institution")}
                        />
                        {errors.institution && <FormError>{errors.institution.message}</FormError>}
                    </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                        <FormLabel htmlFor="type">Tipo</FormLabel>
                        <Controller
                            name="type"
                            control={control}
                            render={({ field }) => (
                                <FormSelect
                                    name={field.name}
                                    value={field.value}
                                    onValueChange={(value) => {
                                        field.onChange(value);
                                        handleTypeChange(value as FinancialAccountFormData["type"]);
                                    }}
                                    options={accountTypes.map((type) => ({
                                        value: type,
                                        label: ACCOUNT_TYPE_LABELS[type],
                                    }))}
                                />
                            )}
                        />
                        {errors.type && <FormError>{errors.type.message}</FormError>}
                    </div>
                    <div className="flex flex-col gap-2">
                        <FormLabel htmlFor="currency">Moneda</FormLabel>
                        <Controller
                            name="currency"
                            control={control}
                            render={({ field }) => (
                                <FormSelect
                                    name={field.name}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    options={currencies.map((currency) => ({
                                        value: currency,
                                        label: currency,
                                    }))}
                                />
                            )}
                        />
                        {errors.currency && <FormError>{errors.currency.message}</FormError>}
                    </div>
                </div>
                {!credit && (
                    <div className="flex flex-col gap-2">
                        <FormLabel htmlFor="openingBalance">Saldo inicial</FormLabel>
                        <FormInput
                            type="number"
                            step="0.01"
                            placeholder="0"
                            {...register("openingBalance")}
                        />
                        {errors.openingBalance && <FormError>{errors.openingBalance.message}</FormError>}
                    </div>
                )}
                {card && (
                    <div className="flex flex-col gap-2">
                        <FormLabel htmlFor="lastFourDigits">Últimos cuatro dígitos</FormLabel>
                        <FormInput
                            placeholder="1234"
                            inputMode="numeric"
                            {...register("lastFourDigits")}
                        />
                        {errors.lastFourDigits && <FormError>{errors.lastFourDigits.message}</FormError>}
                    </div>
                )}
                {credit && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <FormLabel>Límite de crédito</FormLabel>
                            <FormInput
                                type="number"
                                step="0.01"
                                {...register("creditLimit")}
                            />
                            {errors.creditLimit && <FormError>{errors.creditLimit.message}</FormError>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <FormLabel>Deuda actual</FormLabel>
                            <FormInput
                                type="number"
                                step="0.01"
                                {...register("owedAmount")}
                            />
                            {errors.owedAmount && <FormError>{errors.owedAmount.message}</FormError>}
                        </div>
                    </div>
                )}
                {credit && (
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="flex flex-col gap-2">
                            <FormLabel htmlFor="availableCredit">Crédito disponible</FormLabel>
                            <FormInput
                                className={`bg-muted text-muted-foreground`}
                                value={
                                    availableCredit === undefined
                                        ? "—"
                                        : availableCredit.toFixed(2)
                                }
                                readOnly
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <FormLabel htmlFor="billingDate">Día de corte</FormLabel>
                            <Controller
                                name="billingDate"
                                control={control}
                                render={({ field }) => (
                                    <FormSelect
                                        name={field.name}
                                        value={field.value === undefined ? "" : String(field.value)}
                                        onValueChange={(value) => {
                                            const nextValue = number(value);
                                            field.onChange(nextValue);
                                        }}
                                        options={[
                                            { value: "", label: "Sin configurar" },
                                            ...days.map((day) => ({ value: String(day), label: String(day) })),
                                        ]}
                                    />
                                )}
                            />
                            {errors.billingDate && <FormError>{errors.billingDate.message}</FormError>}
                        </div>
                        <div className="flex flex-col gap-2">
                            <FormLabel htmlFor="dueDate">Fecha límite de pago</FormLabel>
                            <Controller
                                name="dueDate"
                                control={control}
                                render={({ field }) => (
                                    <FormSelect
                                        name={field.name}
                                        value={field.value === undefined ? "" : String(field.value)}
                                        onValueChange={(value) => {
                                            const nextValue = number(value);
                                            field.onChange(nextValue);
                                        }}
                                        options={[
                                            { value: "", label: "Sin configurar" },
                                            ...days.map((day) => ({ value: String(day), label: String(day) })),
                                        ]}
                                    />
                                )}
                            />
                            {errors.dueDate && <FormError>{errors.dueDate.message}</FormError>}
                        </div>
                    </div>
                )}
                <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                    <span>
                        <span className="block font-medium">Incluir en patrimonio</span>
                        <span className="text-xs text-muted-foreground">
                            Cuenta para tu patrimonio neto.
                        </span>
                    </span>
                    <FormInput
                        type="checkbox"
                        className="size-4 accent-primary cursor-pointer"
                        {...register("includeInNetWorth")}
                    />
                    {errors.includeInNetWorth && <FormError>{errors.includeInNetWorth.message}</FormError>}
                </label>
            </div>
            <aside className="flex flex-col rounded-xl bg-muted/50 p-4">
                <div className="space-y-4">
                    <div>
                        <p className="text-sm font-medium">Color de la tarjeta</p>
                        <p className="text-xs text-muted-foreground">
                            {getAccountColorLabel(values.color)} es el color seleccionado.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {accountColors.map((color) => (
                            <Button
                                key={color}
                                aria-label={`Elegir ${getAccountColorLabel(color)}`}
                                title={getAccountColorLabel(color)}
                                onClick={() => setValue("color", color, { shouldDirty: true })}
                                className={`size-8 rounded-full ring-offset-2 transition ${values.color === color ? "ring-2 ring-foreground" : "hover:scale-110"}`}
                                style={{ backgroundColor: color, cursor: 'pointer' }}
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
                </div>
                <div className="flex flex-1 items-center">
                    <AccountPlastic
                        preview
                        account={{
                            name: values.name || "Mi cuenta",
                            type: values.type,
                            currency: values.currency,
                            institution: values.institution || null,
                            color: values.color,
                            lastFourDigits: values.lastFourDigits || null,
                            currentBalance: String(
                                credit ? (values.owedAmount ?? 0) : values.openingBalance,
                            ),
                            owedAmount:
                                values.owedAmount === undefined ? null : String(values.owedAmount),
                        }}
                    />
                </div>
            </aside>
            <div className="col-span-full flex justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="h-12 cursor-pointer"
                >
                    Cancelar
                </Button>
                <FormSubmit disabled={isPending}>
                    {isPending
                        ? "Guardando..."
                        : values.id
                            ? "Guardar cambios"
                            : "Crear cuenta"}
                </FormSubmit>
            </div>
        </Form>
    );
}
