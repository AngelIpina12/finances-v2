"use client";

import { useMemo, useState, useTransition } from "react";
import {
    Controller, Resolver, useForm,
    useWatch
} from "react-hook-form";
import toast from "react-hot-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TriangleAlert } from "lucide-react";
import {
    Form, FormError, FormInput,
    FormLabel, FormSelect, FormSubmit,
    SegmentedControl,
} from "@/src/shared/components/forms";
import { saveTransaction } from "../actions/transaction-actions";
import { TransactionFormData, transactionFormSchema } from "../schemas/transaction.schema";
import { createTransactionDraft } from "../utils/transaction-draft";
import { fromAppDateTimeInputValue } from "@/src/shared/utils/local-date-time";
import {
    getBalanceDelta, getCreditLimitImpact,
} from "../domain/transaction-rules";
import { CreditLimitWarning } from "./credit-limit-warning";

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
    color: string | null;
};

interface Props {
    accounts: AccountOption[];
    categories: CategoryOption[];
    initialValues?: Partial<TransactionFormData>;
    onClose: () => void;
}

export function TransactionForm({
    accounts,
    categories,
    initialValues,
    onClose,
}: Props) {
    const [isPending, startTransition] = useTransition();
    const [pendingSubmission, setPendingSubmission] = useState<TransactionFormData | null>(null);

    const {
        register, handleSubmit, formState: { errors },
        control, setValue, clearErrors
    } = useForm<TransactionFormData>({
        resolver: zodResolver(transactionFormSchema) as Resolver<TransactionFormData>,
        defaultValues: initialValues ?? createTransactionDraft(accounts),
        mode: "all",
    });
    const transactionType = useWatch({ control, name: "type" });
    const accountId = useWatch({ control, name: "accountId" });
    const amount = useWatch({ control, name: "amount" });

    const matchingCategories = useMemo(
        () => categories.filter((category) => category.type === transactionType),
        [categories, transactionType],
    );
    const selectedAccount = accounts.find((account) => account.id === accountId);
    const creditImpact = selectedAccount && Number.isFinite(Number(amount))
        ? getFormCreditImpact(selectedAccount, {
            type: transactionType,
            amount: Number(amount),
            accountId,
        }, initialValues)
        : null;

    function changeType(nextType: "income" | "expense") {
        setValue("type", nextType, { shouldDirty: true });
        setValue("categoryId", "", { shouldDirty: true, shouldValidate: false, shouldTouch: false });
        clearErrors("categoryId");
    }

    function persistTransaction(data: TransactionFormData) {
        startTransition(async () => {
            const result = await saveTransaction(data);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            onClose();
        });
    }

    function onSubmit(data: TransactionFormData) {
        const account = accounts.find((item) => item.id === data.accountId);
        const impact = account
            ? getFormCreditImpact(account, data, initialValues)
            : null;

        if (impact?.newlyOverLimit && !data.allowCreditOverLimit) {
            setPendingSubmission(data);
            return;
        }

        persistTransaction(data);
    }

    function confirmOverLimit() {
        if (!pendingSubmission) return;

        const data = {
            ...pendingSubmission,
            allowCreditOverLimit: true,
        };

        setPendingSubmission(null);
        persistTransaction(data);
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
                            setValueAs: fromAppDateTimeInputValue,
                        })}
                    />
                    {errors.date && <FormError>{errors.date.message}</FormError>}
                </div>
            </div>
            {creditImpact && creditImpact.newlyOverLimit > 0 && selectedAccount && (
                <CreditLimitWarning
                    impact={creditImpact}
                    currency={selectedAccount.currency}
                />
            )}
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
                    {isPending
                        ? "Guardando..."
                        : initialValues?.id
                            ? "Guardar cambios"
                            : "Guardar movimiento"}
                </FormSubmit>
            </div>

            <AlertDialog
                open={pendingSubmission !== null}
                onOpenChange={(open) => !open && setPendingSubmission(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            <TriangleAlert />
                        </AlertDialogMedia>
                        <AlertDialogTitle>
                            ¿Registrar aunque exceda el límite?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            La deuda proyectada superará el límite de la tarjeta.
                            Esto puede representar un sobregiro, comisión o un
                            movimiento que el banco autorizó excepcionalmente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            type="button"
                            disabled={isPending}
                            className="cursor-pointer"
                        >
                            Revisar monto
                        </AlertDialogCancel>
                        <AlertDialogAction
                            type="button"
                            disabled={isPending}
                            onClick={confirmOverLimit}
                            className="cursor-pointer bg-amber-600 text-white hover:bg-amber-700"
                        >
                            Registrar de todos modos
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Form>
    );
}

function getFormCreditImpact(
    account: AccountOption,
    next: Pick<TransactionFormData, "accountId" | "type" | "amount">,
    initialValues?: Partial<TransactionFormData>,
) {
    const nextDelta = getBalanceDelta(account, next.type, next.amount);
    const originalDelta = initialValues?.id
        && initialValues.accountId === next.accountId
        && initialValues.type
        && initialValues.amount
        ? getBalanceDelta(account, initialValues.type, initialValues.amount)
        : 0;

    return getCreditLimitImpact(account, nextDelta - originalDelta);
}
