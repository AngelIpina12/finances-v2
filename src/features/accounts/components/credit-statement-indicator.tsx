"use client";

import { motion } from "framer-motion";
import { differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { payCardStatement } from "@/src/features/forecast/actions/card-statement-payment-actions";
import { InsufficientFundsDialog } from "@/src/features/transactions/components/insufficient-funds-dialog";
import type { FundsImpact } from "@/src/features/transactions/domain/transaction-rules";
import type { CreditAccountStatement } from "../queries/get-credit-accounts-statement-data";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency", currency, maximumFractionDigits: 2,
    }).format(value);
}

interface Props {
    creditAccountId: string;
    currency: string;
    creditLimit: number | null;
    owed: number;
    statement: CreditAccountStatement | null;
    hideBalance?: boolean;
}

export function CreditStatementIndicator({
    creditAccountId, currency, creditLimit, owed, statement, hideBalance = false,
}: Props) {
    const router = useRouter();
    const [isPaying, startPaying] = useTransition();
    const [fundsApprovalKind, setFundsApprovalKind] = useState<FundsImpact["kind"] | null>(null);

    const consumedPercent = creditLimit && creditLimit > 0
        ? Math.min(100, Math.round((Math.max(0, owed) / creditLimit) * 100))
        : null;
    const consumedStatus = consumedPercent === null
        ? "healthy"
        : consumedPercent >= 90 ? "exceeded" : consumedPercent >= 70 ? "warning" : "healthy";

    const hasStatement = statement !== null && statement.statementAmount > 0;
    const daysUntilDue = hasStatement ? differenceInCalendarDays(statement.dueAt, new Date()) : null;
    const dueStatus = daysUntilDue === null
        ? "healthy"
        : daysUntilDue <= 1 ? "exceeded" : daysUntilDue <= 5 ? "warning" : "healthy";

    function pay(allowInsufficientFunds = false) {
        if (!statement?.sourceAccountId) return;
        setFundsApprovalKind(null);
        startPaying(async () => {
            const result = await payCardStatement({
                creditAccountId,
                sourceAccountId: statement.sourceAccountId!,
                allowInsufficientFunds,
            });
            if (result.insufficientFunds) {
                setFundsApprovalKind(result.insufficientFunds);
            } else if (result.success) {
                toast.success(result.message);
                router.refresh();
            } else {
                toast.error(result.message);
            }
        });
    }

    return (
        <div className="mt-3 space-y-3 rounded-xl border bg-muted/30 p-3">
            {consumedPercent !== null && (
                <div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Límite usado</span>
                        <span
                            className={
                                consumedStatus === "exceeded"
                                    ? "font-semibold text-destructive"
                                    : consumedStatus === "warning"
                                        ? "font-semibold text-amber-600"
                                        : "font-semibold text-emerald-600"
                            }
                        >
                            {hideBalance ? "••%" : `${consumedPercent}%`}
                        </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${hideBalance ? 0 : consumedPercent}%` }}
                            className={
                                consumedStatus === "exceeded"
                                    ? "h-full bg-destructive"
                                    : consumedStatus === "warning"
                                        ? "h-full bg-amber-500"
                                        : "h-full bg-emerald-500"
                            }
                        />
                    </div>
                </div>
            )}

            {hasStatement ? (
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-xs text-muted-foreground">Estado de cuenta</p>
                        <p className="font-semibold">
                            {hideBalance ? "••••••" : money(statement.statementAmount, currency)}
                        </p>
                        <p
                            className={
                                dueStatus === "exceeded"
                                    ? "text-xs font-medium text-destructive"
                                    : dueStatus === "warning"
                                        ? "text-xs font-medium text-amber-600"
                                        : "text-xs text-muted-foreground"
                            }
                        >
                            {daysUntilDue !== null && daysUntilDue < 0
                                ? `Vencido hace ${Math.abs(daysUntilDue)} día${Math.abs(daysUntilDue) === 1 ? "" : "s"}`
                                : daysUntilDue === 0
                                    ? "Vence hoy"
                                    : `Vence el ${format(statement.dueAt, "d 'de' MMMM", { locale: es })}`}
                        </p>
                    </div>
                    {statement.sourceAccountId ? (
                        <Button
                            size="sm"
                            variant={dueStatus === "exceeded" ? "destructive" : "default"}
                            disabled={isPaying}
                            onClick={() => pay()}
                            className="cursor-pointer shrink-0"
                        >
                            {isPaying ? "Pagando..." : "Pagar"}
                        </Button>
                    ) : (
                        <p className="max-w-32 text-right text-[11px] text-muted-foreground">
                            Configura una cuenta de pago para liquidar en un clic.
                        </p>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CreditCard className="size-3.5 shrink-0" />
                    Sin saldo pendiente en el ciclo actual.
                </div>
            )}

            <InsufficientFundsDialog
                kind={fundsApprovalKind}
                isPending={isPaying}
                onCancel={() => setFundsApprovalKind(null)}
                onConfirm={() => pay(true)}
            />
        </div>
    );
}
