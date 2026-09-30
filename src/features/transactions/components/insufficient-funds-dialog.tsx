"use client";

import { TriangleAlert } from "lucide-react";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { FundsImpact } from "../domain/transaction-rules";

const copy = {
    credit_limit: {
        title: "¿Registrar aunque exceda el límite?",
        description: "La deuda proyectada superará el límite de la tarjeta. Esto puede representar un sobregiro, comisión o un movimiento que el banco autorizó excepcionalmente.",
    },
    negative_balance: {
        title: "¿Registrar aunque la cuenta quede en negativo?",
        description: "El saldo de la cuenta no alcanza para este movimiento. Regístralo sólo si realmente ocurrió, por ejemplo por un sobregiro o porque el saldo en la app está desactualizado.",
    },
} satisfies Record<FundsImpact["kind"], { title: string; description: string }>;

export function InsufficientFundsDialog({
    kind,
    isPending,
    onCancel,
    onConfirm,
}: {
    /** `null` mantiene el diálogo cerrado. */
    kind: FundsImpact["kind"] | null;
    isPending: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const content = copy[kind ?? "negative_balance"];

    return (
        <AlertDialog
            open={kind !== null}
            onOpenChange={(open) => !open && onCancel()}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogMedia className="bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <TriangleAlert />
                    </AlertDialogMedia>
                    <AlertDialogTitle>{content.title}</AlertDialogTitle>
                    <AlertDialogDescription>{content.description}</AlertDialogDescription>
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
                        onClick={onConfirm}
                        className="cursor-pointer bg-amber-600 text-white hover:bg-amber-700"
                    >
                        Registrar de todos modos
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
