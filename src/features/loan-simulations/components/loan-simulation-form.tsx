"use client";

import { useMemo, useTransition } from "react";
import { format } from "date-fns";
import {
    Controller, type Resolver, useForm,
    useWatch,
} from "react-hook-form";
import toast from "react-hot-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    DatePickerField, Form, FormError,
    FormInput, FormLabel, FormSelect,
    FormSubmit, SegmentedControl,
} from "@/src/shared/components/forms";
import { createLoanSimulation, updateLoanSimulation } from "../actions/loan-simulation-actions";
import { annualRateWithVat, buildAmortizationSchedule } from "../domain/amortization-calculator";
import {
    loanSimulationSchema, loanTermsSchema, type LoanSimulationData,
} from "../schemas/loan-simulation.schema";
import { createLoanSimulationDraft } from "../utils/loan-simulation-draft";
import { formatMoney, formatPercent } from "./loan-format";

type Props = {
    initialValues?: LoanSimulationData;
    simulationId?: string;
    onClose: (savedId?: string) => void;
};

export function LoanSimulationForm({ initialValues, simulationId, onClose }: Props) {
    const [isPending, startTransition] = useTransition();
    const {
        register, control, handleSubmit,
        formState: { errors },
    } = useForm<LoanSimulationData>({
        resolver: zodResolver(loanSimulationSchema) as Resolver<LoanSimulationData>,
        defaultValues: initialValues ?? createLoanSimulationDraft(),
        mode: "all",
    });
    const values = useWatch({ control });
    const preview = useMemo(() => {
        const parsed = loanTermsSchema.safeParse(values);
        if (!parsed.success || parsed.data.price <= 0) return null;
        return buildAmortizationSchedule(parsed.data).summary;
    }, [values]);
    const isMsi = values.rateType === "msi";
    const rateWithVat = annualRateWithVat({
        rateType: values.rateType ?? "interest",
        annualRatePercent: Number(values.annualRatePercent || 0),
        rateIncludesVat: Boolean(values.rateIncludesVat),
        vatPercent: Number(values.vatPercent || 0),
    });

    function submit(data: LoanSimulationData) {
        startTransition(async () => {
            const result = simulationId
                ? await updateLoanSimulation(simulationId, data)
                : await createLoanSimulation(data);
            if (!result.success) {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            onClose(result.id);
        });
    }

    return (
        <Form onSubmit={handleSubmit(submit)}>
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nombre" error={errors.name?.message} htmlFor="loan-name">
                    <FormInput id="loan-name" placeholder="Ej. KIA K3 – 36 MSI" {...register("name")} />
                </Field>
                <Field label="Notas" error={errors.notes?.message} htmlFor="loan-notes">
                    <FormInput id="loan-notes" placeholder="Agencia, vendedor, vigencia…" {...register("notes")} />
                </Field>
            </div>

            <Section title="Precio y enganche">
                <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Precio de venta (con IVA)" error={errors.price?.message} htmlFor="loan-price">
                        <FormInput id="loan-price" type="number" min="0" step="0.01" {...register("price")} />
                    </Field>
                    <Field label="Bono o descuento" error={errors.bonus?.message} htmlFor="loan-bonus">
                        <FormInput id="loan-bonus" type="number" min="0" step="0.01" {...register("bonus")} />
                    </Field>
                    <Field label="Accesorios" error={errors.accessories?.message} htmlFor="loan-accessories">
                        <FormInput id="loan-accessories" type="number" min="0" step="0.01" {...register("accessories")} />
                    </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Enganche en">
                        <Controller
                            name="downPaymentMode"
                            control={control}
                            render={({ field }) => (
                                <SegmentedControl
                                    className="mb-0"
                                    items={["percent", "amount"] as const}
                                    labels={{ percent: "Porcentaje", amount: "Monto" }}
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                            )}
                        />
                    </Field>
                    <Field
                        label={values.downPaymentMode === "percent" ? "Enganche (%)" : "Enganche ($)"}
                        error={errors.downPaymentValue?.message}
                        htmlFor="loan-down"
                    >
                        <FormInput id="loan-down" type="number" min="0" step="0.01" {...register("downPaymentValue")} />
                    </Field>
                </div>
            </Section>

            <Section title="Crédito">
                <Controller
                    name="rateType"
                    control={control}
                    render={({ field }) => (
                        <SegmentedControl
                            className="mb-0"
                            items={["interest", "msi"] as const}
                            labels={{ interest: "Con intereses", msi: "Meses sin intereses" }}
                            value={field.value}
                            onChange={field.onChange}
                        />
                    )}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                    {!isMsi && (
                        <Field label="Tasa anual (%)" error={errors.annualRatePercent?.message} htmlFor="loan-rate">
                            <FormInput id="loan-rate" type="number" min="0" step="0.01" {...register("annualRatePercent")} />
                        </Field>
                    )}
                    {!isMsi && (
                        <Field label="IVA sobre intereses (%)" error={errors.vatPercent?.message} htmlFor="loan-vat">
                            <FormInput id="loan-vat" type="number" min="0" step="0.01" {...register("vatPercent")} />
                        </Field>
                    )}
                    <Field label="Plazo (meses)" error={errors.termMonths?.message} htmlFor="loan-term">
                        <FormInput id="loan-term" type="number" min="1" max="120" step="1" {...register("termMonths")} />
                    </Field>
                    <Field label="Primer vencimiento" error={errors.firstDueDate?.message} htmlFor="loan-first-due">
                        <Controller
                            name="firstDueDate"
                            control={control}
                            render={({ field }) => (
                                <DatePickerField
                                    id="loan-first-due"
                                    value={field.value ? new Date(`${field.value}T12:00:00`) : undefined}
                                    onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                />
                            )}
                        />
                    </Field>
                </div>
                {!isMsi && (
                    <ToggleRow
                        control={control}
                        name="rateIncludesVat"
                        title="La tasa ya incluye IVA"
                        description={`Tasa con IVA usada en el cálculo: ${formatPercent(rateWithVat)} anual. Los bancos la redondean a 2 decimales.`}
                    />
                )}
                <ToggleRow
                    control={control}
                    name="shiftToBusinessDay"
                    title="Recorrer pagos al siguiente día hábil"
                    description="Si el vencimiento cae en sábado o domingo, se paga el lunes."
                />
            </Section>

            <Section title="Comisión por apertura">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Tipo de comisión">
                        <Controller
                            name="openingFeeMode"
                            control={control}
                            render={({ field }) => (
                                <FormSelect
                                    name={field.name}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    options={[
                                        { value: "none", label: "Sin comisión" },
                                        { value: "percent", label: "% del monto a financiar (con IVA)" },
                                        { value: "amount", label: "Monto fijo (con IVA)" },
                                    ]}
                                />
                            )}
                        />
                    </Field>
                    {values.openingFeeMode !== "none" && (
                        <Field
                            label={values.openingFeeMode === "percent" ? "Comisión (%)" : "Comisión ($)"}
                            error={errors.openingFeeValue?.message}
                            htmlFor="loan-fee"
                        >
                            <FormInput id="loan-fee" type="number" min="0" step="0.01" {...register("openingFeeValue")} />
                        </Field>
                    )}
                </div>
                {values.openingFeeMode !== "none" && (
                    <ToggleRow
                        control={control}
                        name="openingFeeFinanced"
                        title="Financiar la comisión"
                        description="Se suma al crédito en lugar de pagarse con el enganche."
                    />
                )}
            </Section>

            <Section title="Seguros">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Seguro de auto, primer año" error={errors.carInsuranceFirstYear?.message} htmlFor="loan-car-1">
                        <FormInput id="loan-car-1" type="number" min="0" step="0.01" {...register("carInsuranceFirstYear")} />
                    </Field>
                    {Number(values.termMonths || 0) > 12 && (
                        <Field label="Seguro de auto anual, resto del plazo" error={errors.carInsuranceLaterAnnual?.message} htmlFor="loan-car-later">
                            <FormInput id="loan-car-later" type="number" min="0" step="0.01" {...register("carInsuranceLaterAnnual")} />
                            <p className="text-xs text-muted-foreground">Se prorratea en las mensualidades del mes 13 en adelante.</p>
                        </Field>
                    )}
                </div>
                {Number(values.carInsuranceFirstYear || 0) > 0 && (
                    <ToggleRow
                        control={control}
                        name="carInsuranceFinanced"
                        title="Financiar el seguro del primer año"
                        description="Se amortiza junto con el auto a la misma tasa; si no, se paga de contado al inicio."
                    />
                )}
                <Field label="Seguro de vida">
                    <Controller
                        name="lifeInsuranceMode"
                        control={control}
                        render={({ field }) => (
                            <SegmentedControl
                                className="mb-0"
                                items={["none", "fixed", "balance"] as const}
                                labels={{ none: "Sin seguro", fixed: "Cuota fija", balance: "Sobre saldo" }}
                                value={field.value}
                                onChange={field.onChange}
                            />
                        )}
                    />
                </Field>
                {values.lifeInsuranceMode !== "none" && (
                    <Field
                        label={values.lifeInsuranceMode === "fixed" ? "Cuota mensual ($)" : "Tarifa mensual al millar"}
                        error={errors.lifeInsuranceValue?.message}
                        htmlFor="loan-life"
                    >
                        <FormInput id="loan-life" type="number" min="0" step="0.0001" {...register("lifeInsuranceValue")} />
                        <p className="text-xs text-muted-foreground">
                            {values.lifeInsuranceMode === "fixed"
                                ? "Se cobra igual cada mes, como en la mayoría de las cotizaciones de agencia."
                                : "Pesos por cada $1,000 de saldo pendiente al inicio del mes; la cuota baja conforme pagas."}
                        </p>
                    </Field>
                )}
            </Section>

            <div className="grid gap-3 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-4">
                <PreviewMetric label="Pago inicial" value={preview ? formatMoney(preview.initialPayment) : "—"} />
                <PreviewMetric label="Monto a financiar" value={preview ? formatMoney(preview.financedTotal) : "—"} />
                <PreviewMetric label="Primera mensualidad" value={preview ? formatMoney(preview.firstPayment) : "—"} />
                <PreviewMetric label="Total a pagar" value={preview ? formatMoney(preview.totalPaid) : "—"} />
            </div>

            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onClose()} className="cursor-pointer">
                    Cancelar
                </Button>
                <FormSubmit disabled={isPending}>
                    {isPending ? "Guardando..." : simulationId ? "Guardar cambios" : "Guardar simulación"}
                </FormSubmit>
            </div>
        </Form>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <fieldset className="space-y-4 rounded-2xl border p-4">
            <legend className="px-2 text-sm font-semibold">{title}</legend>
            {children}
        </fieldset>
    );
}

function ToggleRow({ control, name, title, description }: {
    control: ReturnType<typeof useForm<LoanSimulationData>>["control"];
    name: "rateIncludesVat" | "shiftToBusinessDay" | "openingFeeFinanced" | "carInsuranceFinanced";
    title: string;
    description: string;
}) {
    return (
        <Controller
            name={name}
            control={control}
            render={({ field }) => (
                <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border bg-muted/30 p-4 transition-colors hover:bg-muted/50">
                    <span>
                        <span className="block text-sm font-medium">{title}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{description}</span>
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} className="cursor-pointer" />
                </label>
            )}
        />
    );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-semibold">{value}</p>
        </div>
    );
}

function Field({ children, error, htmlFor, label }: {
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
