"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
    Archive, Pencil, Plus,
    WalletCards, X
} from "lucide-react";
import {
    useMemo, useState, useTransition
} from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { financialAccounts } from "@/src/db/schema";
import { archiveFinancialAccount } from "../actions/financial-account-actions";
import { FinancialAccountFormData } from "../schemas/financial-account.schema";
import { AccountPlastic } from "./accounts-plastic";
import { AccountForm } from "./accounts-form";
import { formatMoney } from "../utils/format-account-money";
import { ACCOUNT_TYPE_LABELS } from "../constants/account.constants";
import { createFinancialAccountDraft, toFinancialAccountDraft } from "../utils/financial-account-draft";
import { CardTitle } from "@/src/shared/components/ui/card";

type FinancialAccount = typeof financialAccounts.$inferSelect;
type Filter = "all" | FinancialAccountFormData["type"];

interface Props {
    accounts: FinancialAccount[]
}

export function AccountsClient({ accounts }: Props) {
    const [filter, setFilter] = useState<Filter>("all");
    const [hideBalances, setHideBalances] = useState(false);
    const [accountToEdit, setAccountToEdit] = useState<FinancialAccount | "new" | null>(null);
    const [accountToArchive, setAccountToArchive] = useState<FinancialAccount | null>(null);
    const [isArchiving, startArchive] = useTransition();

    const visibleAccounts = useMemo(() =>
        accounts.filter((account) => filter === "all" || account.type === filter),
        [accounts, filter],
    );

    const totalsByCurrency = accounts
        .filter((account) => account.includeInNetWorth)
        .reduce<Record<string, number>>((totals, account) => {
            const balance =
                account.type === "credit"
                    ? -Number(account.owedAmount ?? account.currentBalance)
                    : Number(account.currentBalance);
            totals[account.currency] = (totals[account.currency] ?? 0) + balance;
            return totals;
        }, {});

    const balanceSummary = Object.entries(totalsByCurrency)
        .map(([currency, balance]) => formatMoney(balance, currency, hideBalances))
        .join(" · ");

    function archiveSelectedAccount() {
        if (!accountToArchive) return;
        startArchive(async () => {
            const result = await archiveFinancialAccount(accountToArchive.id);
            if (result.success) {
                toast.success(result.message);
                setAccountToArchive(null);
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <div className="space-y-7">
            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground">
                        Tu dinero, en un solo lugar
                    </p>
                    <CardTitle
                        className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl"
                    >
                        Mis cuentas
                    </CardTitle>
                    <p className="text-muted-foreground">
                        {accounts.length
                            ? `${accounts.length} cuentas activas · ${balanceSummary || "Sin saldos registrados"}`
                            : "Agrega una cuenta para comenzar a entender tu patrimonio."}
                    </p>
                </div>
                <Button
                    size="lg"
                    onClick={() => setAccountToEdit("new")}
                >
                    <Plus />
                    Agregar cuenta
                </Button>
            </header>
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    size="sm"
                    variant={filter === "all" ? "default" : "outline"}
                    onClick={() => setFilter("all")}
                >
                    Todas
                </Button>
                {(["cash", "debit", "credit", "wallet"] as const).map((type) => (
                    <Button
                        key={type}
                        size="sm"
                        variant={filter === type ? "default" : "outline"}
                        onClick={() => setFilter(type)}
                    >
                        {ACCOUNT_TYPE_LABELS[type]}
                    </Button>
                ))}
                <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                        type="checkbox"
                        checked={hideBalances}
                        onChange={(event) => setHideBalances(event.target.checked)}
                        className="size-4 accent-primary"
                    />
                    Ocultar saldos
                </label>
            </div>
            {!accounts.length ? (
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid min-h-90 place-items-center rounded-2xl border border-dashed bg-muted/25 p-8 text-center"
                >
                    <div className="max-w-sm">
                        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                            <WalletCards />
                        </span>
                        <h2 className="mt-5 text-xl font-semibold">
                            Tu primera cuenta empieza aquí
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Agrega efectivo, una cuenta de débito o una tarjeta para comenzar
                            a organizar tus movimientos.
                        </p>
                        <Button
                            className="mt-5"
                            onClick={() => setAccountToEdit("new")}
                        >
                            <Plus />
                            Crear mi primera cuenta
                        </Button>
                    </div>
                </motion.section>
            ) : (
                <motion.section
                    layout
                    className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
                >
                    <AnimatePresence mode="popLayout">
                        {visibleAccounts.map((account, index) => (
                            <motion.article
                                key={account.id}
                                layout
                                initial={{ opacity: 0, y: 18 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ delay: index * 0.04 }}
                                className="group rounded-2xl border bg-card p-3 shadow-sm transition-shadow hover:shadow-lg"
                            >
                                <motion.div
                                    whileHover={{ y: -4, rotateX: 1 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                >
                                    <AccountPlastic
                                        account={account}
                                        hideBalance={hideBalances || account.hideBalance}
                                    />
                                </motion.div>
                                <div className="flex items-start justify-between gap-3 px-2 pb-1 pt-4">
                                    <div>
                                        <p className="font-medium">{account.name}</p>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency}
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            onClick={() => setAccountToEdit(account)}
                                            aria-label={`Editar ${account.name}`}
                                        >
                                            <Pencil />
                                        </Button>
                                        <Button
                                            size="icon-sm"
                                            variant="ghost"
                                            disabled={isArchiving}
                                            onClick={() => setAccountToArchive(account)}
                                            aria-label={`Archivar ${account.name}`}
                                        >
                                            <Archive />
                                        </Button>
                                    </div>
                                </div>
                            </motion.article>
                        ))}
                    </AnimatePresence>
                </motion.section>
            )}
            <Dialog
                open={accountToEdit !== null}
                onOpenChange={(open) => !open && setAccountToEdit(null)}
            >
                <DialogContent
                    className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-none overflow-y-auto p-6 sm:w-[min(92vw,72rem)] sm:max-w-none lg:p-8"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle>
                                    {accountToEdit && accountToEdit !== "new" ? "Editar cuenta" : "Nueva cuenta"}
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    Configura lo esencial. Podrás añadir movimientos y detalles
                                    adicionales después.
                                </DialogDescription>
                            </div>
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setAccountToEdit(null)}
                            >
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    {accountToEdit && (
                        <AccountForm
                            initialValues={
                                accountToEdit === "new"
                                    ? createFinancialAccountDraft()
                                    : toFinancialAccountDraft(accountToEdit)
                            }
                            onClose={() => setAccountToEdit(null)}
                        />
                    )}
                </DialogContent>
            </Dialog>
            <AlertDialog
                open={accountToArchive !== null}
                onOpenChange={(open) => !open && setAccountToArchive(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-destructive/10 text-destructive">
                            <Archive />
                        </AlertDialogMedia>
                        <AlertDialogTitle>¿Archivar esta cuenta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {accountToArchive
                                ? `“${accountToArchive.name}” dejará de mostrarse en tu dashboard. Sus movimientos se conservarán.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isArchiving}>
                            Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={isArchiving}
                            onClick={archiveSelectedAccount}
                        >
                            {isArchiving ? "Archivando..." : "Archivar cuenta"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
