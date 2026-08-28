"use client";

import {
    useMemo, useState, useTransition
} from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { createTransaction } from "../actions/transaction-actions";

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

export function TransactionForm({ accounts, categories, onClose }: {
    accounts: AccountOption[];
    categories: CategoryOption[];
    onClose: () => void;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [type, setType] = useState<"income" | "expense">("expense");
    const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
    const [categoryId, setCategoryId] = useState("");
    const [amount, setAmount] = useState("");
    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [merchant, setMerchant] = useState("");
    const [notes, setNotes] = useState("");

    const matchingCategories = useMemo(
        () => categories.filter((category) => category.type === type),
        [categories, type],
    );

    function changeType(nextType: "income" | "expense") {
        setType(nextType);
        setCategoryId("");
    }

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        startTransition(async () => {
            const result = await createTransaction({
                type,
                accountId,
                categoryId,
                amount: Number(amount),
                date: new Date(`${date}T12:00:00`),
                merchant,
                notes,
            });
            if (!result.success) {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            router.refresh();
            onClose();
        });
    }

    return (
        <form onSubmit={submit} className="space-y-5">
            <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
                <button
                    type="button"
                    onClick={() => changeType("expense")}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${type === "expense" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                    Gasto
                </button>
                <button
                    type="button"
                    onClick={() => changeType("income")}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition ${type === "income" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                    Ingreso
                </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                    Cuenta
                    <select
                        required
                        value={accountId}
                        onChange={(event) => setAccountId(event.target.value)}
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                    >
                        <option value="" disabled>
                            Selecciona una cuenta
                        </option>
                        {accounts.map((account) => (
                            <option key={account.id} value={account.id}>
                                {account.name} · {account.currency}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="space-y-2 text-sm font-medium">
                    Categoría
                    <select
                        required
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                    >
                        <option value="" disabled>
                            Selecciona una categoría
                        </option>
                        {matchingCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-medium">
                    Monto
                    <input
                        required
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                        placeholder="0.00"
                    />
                </label>
                <label className="space-y-2 text-sm font-medium">
                    Fecha
                    <input
                        required
                        type="date"
                        value={date}
                        onChange={(event) => setDate(event.target.value)}
                        className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                    />
                </label>
            </div>
            <label className="block space-y-2 text-sm font-medium">
                Comercio o descripción{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
                <input
                    value={merchant}
                    onChange={(event) => setMerchant(event.target.value)}
                    className="h-10 w-full rounded-lg border bg-background px-3 text-sm"
                    placeholder={type === "expense" ? "Ej. Supermercado" : "Ej. Nómina"}
                />
            </label>
            <label className="block space-y-2 text-sm font-medium">
                Notas{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
                <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="min-h-20 w-full rounded-lg border bg-background p-3 text-sm"
                />
            </label>
            <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    disabled={isPending || !accounts.length || !matchingCategories.length}
                >
                    {isPending ? "Guardando..." : "Guardar movimiento"}
                </Button>
            </div>
        </form>
    );
}
