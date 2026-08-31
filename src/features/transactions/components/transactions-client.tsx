"use client";

import {
    ArrowDownLeft, ArrowUpRight, FolderPlus,
    Plus, ReceiptText,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { bootstrapDefaultCategories } from "../actions/transaction-actions";
import { TransactionForm } from "./transaction-form";
import { formatLocalDateTime } from "@/src/shared/utils/local-date-time";

type FormData =
    React.ComponentProps<typeof TransactionForm> extends {
        accounts: infer A;
        categories: infer C;
    }
    ? { accounts: A; categories: C }
    : never;

type TransactionItem = {
    id: string;
    type: "income" | "expense" | "transfer";
    amount: string;
    currency: "MXN" | "USD" | "EUR" | "GBP";
    date: Date;
    merchant: string | null;
    accountName: string;
    categoryName: string | null;
};

const money = (amount: string, currency: string) =>
    new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
    }).format(Number(amount));

export function TransactionsClient({ accounts, categories, transactions }: FormData & {
    transactions: TransactionItem[]
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
    const [isBootstrapping, startBootstrap] = useTransition();
    const visibleTransactions = transactions.filter(
        (item) => typeFilter === "all" || item.type === typeFilter,
    );
    const canCreate = accounts.length > 0 && categories.length > 0;

    function bootstrap() {
        startBootstrap(async () => {
            const result = await bootstrapDefaultCategories();
            if (!result.success) {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            router.refresh();
        });
    }

    return (
        <div className="space-y-7">
            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-sm font-medium text-primary">
                        ACTIVIDAD FINANCIERA
                    </p>
                    <h1 className="text-3xl font-semibold tracking-tight">Movimientos</h1>
                    <p className="mt-1 text-muted-foreground">
                        Registra cada ingreso y gasto para mantener tus saldos al día.
                    </p>
                </div>
                <Button size="lg" onClick={() => setOpen(true)} disabled={!canCreate}>
                    <Plus />
                    Nuevo movimiento
                </Button>
            </header>

            {!accounts.length ? (
                <EmptyState
                    icon={<ReceiptText />}
                    title="Primero agrega una cuenta"
                    description="Los movimientos necesitan una cuenta para actualizar su saldo."
                    action={
                        <Button variant="outline" onClick={() => router.push("/accounts")}>
                            Ir a cuentas
                        </Button>
                    }
                />
            ) : !categories.length ? (
                <EmptyState
                    icon={<FolderPlus />}
                    title="Prepara tus categorías"
                    description="Crearemos categorías iniciales para que puedas registrar ingresos y gastos."
                    action={
                        <Button onClick={bootstrap} disabled={isBootstrapping}>
                            <FolderPlus />
                            {isBootstrapping ? "Preparando..." : "Crear categorías iniciales"}
                        </Button>
                    }
                />
            ) : (
                <>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant={typeFilter === "all" ? "default" : "outline"}
                            onClick={() => setTypeFilter("all")}
                        >
                            Todos
                        </Button>
                        <Button
                            size="sm"
                            variant={typeFilter === "expense" ? "default" : "outline"}
                            onClick={() => setTypeFilter("expense")}
                        >
                            Gastos
                        </Button>
                        <Button
                            size="sm"
                            variant={typeFilter === "income" ? "default" : "outline"}
                            onClick={() => setTypeFilter("income")}
                        >
                            Ingresos
                        </Button>
                    </div>
                    {!visibleTransactions.length ? (
                        <EmptyState
                            icon={<ReceiptText />}
                            title="Aún no hay movimientos"
                            description="Registra el primero para actualizar el saldo de tu cuenta."
                        />
                    ) : (
                        <TransactionsList transactions={visibleTransactions} />
                    )}
                </>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="w-[calc(100vw-2rem)] max-w-none sm:w-[min(92vw,40rem)] sm:max-w-none">
                    <DialogHeader>
                        <DialogTitle>Nuevo movimiento</DialogTitle>
                        <DialogDescription>
                            El saldo de la cuenta se actualizará al guardar.
                        </DialogDescription>
                    </DialogHeader>
                    <TransactionForm
                        accounts={accounts}
                        categories={categories}
                        onClose={() => setOpen(false)}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}

function EmptyState({ icon, title, description, action }: {
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: React.ReactNode;
}) {
    return (
        <section className="grid min-h-64 place-items-center rounded-2xl border border-dashed bg-muted/25 p-8 text-center">
            <div className="max-w-sm">
                <span className="mx-auto block size-10 text-muted-foreground">
                    {icon}
                </span>
                <h2 className="mt-4 text-xl font-semibold">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                {action && <div className="mt-5">{action}</div>}
            </div>
        </section>
    );
}

function TransactionsList({ transactions }: { transactions: TransactionItem[] }) {
    return (
        <section className="overflow-hidden rounded-2xl border bg-card">
            <div className="divide-y">
                {transactions.map((item) => {
                    const income = item.type === "income";
                    const Icon = income ? ArrowUpRight : ArrowDownLeft;
                    return (
                        <article
                            key={item.id}
                            className="flex items-center gap-3 p-4 sm:p-5"
                        >
                            <span
                                className={`grid size-10 place-items-center rounded-xl ${income ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}
                            >
                                <Icon className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                    {item.merchant || item.categoryName || "Movimiento"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {item.categoryName || "Sin categoría"} · {item.accountName} ·{" "}
                                    {formatLocalDateTime(item.date)}
                                </p>
                            </div>
                            <p
                                className={`text-sm font-semibold ${income ? "text-emerald-600" : "text-foreground"}`}
                            >
                                {income ? "+" : "-"}
                                {money(item.amount, item.currency)}
                            </p>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}
