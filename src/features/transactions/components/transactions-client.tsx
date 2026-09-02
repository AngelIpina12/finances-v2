"use client";

import { motion } from "framer-motion";
import {
    ArrowLeftRight, FolderPlus, Plus,
    ReceiptText, X, XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CardTitle } from "@/src/shared/components/ui/card";
import { bootstrapDefaultCategories } from "../../categories/actions/category-actions";
import { cancelTransaction } from "../actions/transaction-actions";
import type { TransactionListItem } from "../queries/get-transaction-data";
import { toTransactionDraft } from "../utils/transaction-draft";
import { TransactionFilters, type TransactionFilter } from "./transaction-filters";
import { TransactionForm } from "./transaction-form";
import { TransactionList } from "./transaction-list";
import { TransferForm } from "./transfer-form";

type FormData = React.ComponentProps<typeof TransactionForm> extends {
    accounts: infer A;
    categories: infer C;
}
    ? { accounts: A; categories: C }
    : never;

interface TransactionsClientProps extends FormData {
    transactions: TransactionListItem[];
}

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    action?: React.ReactNode;
}

export function TransactionsClient({ accounts, categories, transactions }: TransactionsClientProps) {
    const router = useRouter();
    const [transactionToEdit, setTransactionToEdit] = useState<TransactionListItem | "new" | null>(null);
    const [transferOpen, setTransferOpen] = useState(false);
    const [transactionToCancel, setTransactionToCancel] = useState<TransactionListItem | null>(null);
    const [typeFilter, setTypeFilter] = useState<TransactionFilter>("all");
    const [isBootstrapping, startBootstrap] = useTransition();
    const [isCancelling, startCancel] = useTransition();

    const visibleTransactions = transactions.filter((item) => {
        if (typeFilter === "cancelled") {
            return item.status === "cancelled";
        }

        if (item.status === "cancelled") {
            return false;
        }

        return typeFilter === "all" || item.type === typeFilter;
    });
    const canCreate = accounts.length > 0 && categories.length > 0;
    const canTransfer = accounts.some(
        (account, index) => accounts.some(
            (other, otherIndex) => index !== otherIndex && account.currency === other.currency,
        ),
    );

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

    function cancelSelectedTransaction() {
        if (!transactionToCancel) {
            return;
        }

        startCancel(async () => {
            const result = await cancelTransaction(transactionToCancel.id);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            setTransactionToCancel(null);
            router.refresh();
        });
    }

    function closeTransactionForm() {
        setTransactionToEdit(null);
        router.refresh();
    }

    function closeTransferForm() {
        setTransferOpen(false);
        router.refresh();
    }

    return (
        <div className="space-y-7">
            <motion.header
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
            >
                <div className="space-y-2">
                    <p className="font-label text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground">
                        Actividad financiera
                    </p>
                    <CardTitle className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">
                        Movimientos
                    </CardTitle>
                    <p className="text-muted-foreground">
                        Registra, corrige y transfiere dinero manteniendo tus saldos al día.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        size="lg"
                        variant="outline"
                        onClick={() => setTransferOpen(true)}
                        disabled={!canTransfer}
                        className="cursor-pointer"
                    >
                        <ArrowLeftRight />
                        Transferir
                    </Button>
                    <Button
                        size="lg"
                        onClick={() => setTransactionToEdit("new")}
                        disabled={!canCreate}
                        className="cursor-pointer"
                    >
                        <Plus />
                        Nuevo movimiento
                    </Button>
                </div>
            </motion.header>

            {!accounts.length ? (
                <EmptyState
                    icon={<ReceiptText />}
                    title="Primero agrega una cuenta"
                    description="Los movimientos necesitan una cuenta para actualizar su saldo."
                    action={(
                        <Button onClick={() => router.push("/accounts")} className="cursor-pointer">
                            Ir a cuentas
                        </Button>
                    )}
                />
            ) : !categories.length ? (
                <EmptyState
                    icon={<FolderPlus />}
                    title="Prepara tus categorías"
                    description="Crearemos categorías iniciales para que puedas registrar ingresos y gastos."
                    action={(
                        <Button onClick={bootstrap} disabled={isBootstrapping} className="cursor-pointer">
                            <FolderPlus />
                            {isBootstrapping ? "Preparando..." : "Crear categorías iniciales"}
                        </Button>
                    )}
                />
            ) : (
                <>
                    <TransactionFilters value={typeFilter} onChange={setTypeFilter} />
                    {!visibleTransactions.length ? (
                        <EmptyState
                            icon={<ReceiptText />}
                            title={typeFilter === "cancelled"
                                ? "No hay movimientos cancelados"
                                : "Aún no hay movimientos"}
                            description={typeFilter === "cancelled"
                                ? "Los movimientos que canceles se conservarán aquí."
                                : "Registra el primero para actualizar el saldo de tu cuenta."}
                        />
                    ) : (
                        <TransactionList
                            transactions={visibleTransactions}
                            onEdit={setTransactionToEdit}
                            onCancel={setTransactionToCancel}
                        />
                    )}
                </>
            )}

            <Dialog
                open={transactionToEdit !== null}
                onOpenChange={(open) => !open && setTransactionToEdit(null)}
            >
                <DialogContent
                    className="w-[calc(100vw-2rem)] max-w-none p-6 sm:w-[min(92vw,40rem)] sm:max-w-none"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="font-serif text-2xl">
                                    {transactionToEdit === "new"
                                        ? "Nuevo movimiento"
                                        : "Editar movimiento"}
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    El saldo de la cuenta se recalculará al guardar.
                                </DialogDescription>
                            </div>
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setTransactionToEdit(null)}
                            >
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    {transactionToEdit && (
                        <TransactionForm
                            key={transactionToEdit === "new" ? "new" : transactionToEdit.id}
                            accounts={accounts}
                            categories={categories}
                            initialValues={transactionToEdit === "new"
                                ? undefined
                                : toTransactionDraft({
                                    ...transactionToEdit,
                                    type: transactionToEdit.type as "income" | "expense",
                                })}
                            onClose={closeTransactionForm}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                <DialogContent
                    className="w-[calc(100vw-2rem)] max-w-none p-6 sm:w-[min(92vw,40rem)] sm:max-w-none"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="font-serif text-2xl">
                                    Transferir entre cuentas
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    Mueve dinero sin alterar tus ingresos ni gastos.
                                </DialogDescription>
                            </div>
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setTransferOpen(false)}
                                className="cursor-pointer"
                            >
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    <TransferForm accounts={accounts} onClose={closeTransferForm} />
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={transactionToCancel !== null}
                onOpenChange={(open) => !open && setTransactionToCancel(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-destructive/10 text-destructive">
                            <XCircle />
                        </AlertDialogMedia>
                        <AlertDialogTitle>¿Cancelar este movimiento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {transactionToCancel?.type === "transfer"
                                ? "Se cancelarán ambos lados de la transferencia y sus saldos serán revertidos."
                                : "Su efecto en el saldo se revertirá. El registro permanecerá en tu historial."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCancelling} className="cursor-pointer">Volver</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={isCancelling}
                            onClick={cancelSelectedTransaction}
                            className="cursor-pointer"
                        >
                            {isCancelling ? "Cancelando..." : "Cancelar movimiento"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid min-h-90 place-items-center rounded-2xl border border-dashed bg-muted/25 p-8 text-center"
        >
            <div className="max-w-sm">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                    {icon}
                </span>
                <h2 className="mt-4 text-xl font-semibold">{title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{description}</p>
                {action && <div className="mt-5">{action}</div>}
            </div>
        </motion.section>
    );
}
