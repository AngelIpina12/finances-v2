"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
    Ban, CreditCard, Plus, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CardTitle } from "@/src/shared/components/ui/card";
import { formatAppDate } from "@/src/shared/utils/local-date-time";
import toast from "react-hot-toast";
import { cancelFinancingPlan } from "../actions/financing-actions";
import type { FinancingData } from "../queries/get-financing-data";
import { FinancingPaymentForm } from "./financing-payment-form";
import { FinancingPlanForm } from "./financing-plan-form";

const money = (amount: number, currency: string) => new Intl.NumberFormat("es-MX", {
    style: "currency", currency, maximumFractionDigits: 2,
}).format(amount);

type Props = FinancingData;

interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

export function FinancingClient({ purchases, paymentAccounts, plans }: Props) {
    const router = useRouter();
    const [isCancelling, startCancel] = useTransition();
    const [planToCreate, setPlanToCreate] = useState<"new" | null>(null);
    const [installmentToPay, setInstallmentToPay] = useState<string | null>(null);
    const [planToCancel, setPlanToCancel] = useState<Props["plans"][number] | null>(null);
    const [showCancelled, setShowCancelled] = useState(false);
    const visiblePlans = showCancelled
        ? plans
        : plans.filter((plan) => plan.status !== "cancelled");
    const selectedInstallment = plans.flatMap((plan) => plan.installments)
        .find((installment) => installment.id === installmentToPay);

    function closePlanForm() {
        setPlanToCreate(null);
        router.refresh();
    }

    function closePaymentForm() {
        setInstallmentToPay(null);
        router.refresh();
    }

    function cancelSelectedPlan() {
        if (!planToCancel) return;

        startCancel(async () => {
            const result = await cancelFinancingPlan(planToCancel.id);

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            setPlanToCancel(null);
            router.refresh();
        });
    }

    return (
        <div className="space-y-7">
            <motion.header
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
            >
                <div className="space-y-2">
                    <p className="font-label text-xs font-semibold uppercase tracking-[0.2em] text-accent-foreground">
                        Compras a meses y deudas planificadas
                    </p>
                    <CardTitle className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">
                        Financiamientos
                    </CardTitle>
                    <p className="max-w-2xl text-muted-foreground">
                        Convierte una compra de tarjeta en cuotas sin volver a registrar el gasto.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {plans.some((plan) => plan.status === "cancelled") && (
                        <Button
                            size="lg"
                            variant="outline"
                            onClick={() => setShowCancelled((visible) => !visible)}
                            className="cursor-pointer"
                        >
                            {showCancelled ? "Ocultar cancelados" : "Ver cancelados"}
                        </Button>
                    )}
                    <Button size="lg" onClick={() => setPlanToCreate("new")} disabled={!purchases.length} className="cursor-pointer">
                        <Plus /> Nuevo financiamiento
                    </Button>
                </div>
            </motion.header>

            {!visiblePlans.length ? (
                <EmptyState
                    icon={<CreditCard />}
                    title={plans.length ? "No hay financiamientos visibles." : "Hora de registrar una compra."}
                    description={plans.length
                        ? "Los financiamientos cancelados están ocultos. Puedes mostrarlos cuando los necesites."
                        : "Primero registra una compra de gasto en una tarjeta de crédito."}
                    actionLabel={plans.length ? "Crear financiamiento" : "Ir a movimientos"}
                    onAction={plans.length ? () => setPlanToCreate("new") : () => router.push("/transactions")}
                />
                // <motion.section
                //     initial={{ opacity: 0, y: 12 }}
                //     animate={{ opacity: 1, y: 0 }}
                //     transition={{ duration: 0.3, delay: 0.08 }}
                //     className="grid min-h-80 place-items-center rounded-2xl border border-dashed bg-muted/25 p-8 text-center"
                // >
                //     <div className="max-w-md">
                //         <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><CreditCard /></span>
                //         <h2 className="mt-5 text-xl font-semibold">Planea tus compras a meses</h2>
                //         <p className="mt-2 text-sm text-muted-foreground">
                //             {purchases.length ? "Selecciona una compra vigente de tarjeta y genera su calendario de cuotas." : "Primero registra una compra de gasto en una tarjeta de crédito."}
                //         </p>
                //         {purchases.length > 0 && (
                //             <Button className="mt-5 cursor-pointer" onClick={() => setPlanToCreate("new")}><Plus /> Crear financiamiento</Button>
                //         )}
                //     </div>
                // </motion.section>
            ) : (
                <motion.section layout className="grid gap-5 xl:grid-cols-2">
                    <AnimatePresence mode="popLayout">
                        {visiblePlans.map((plan, index) => {
                            const paid = plan.installments.filter((item) => item.paidAt).length;
                            const paidAmount = plan.installments.filter((item) => item.paidAt)
                                .reduce((total, item) => total + item.amount, 0);
                            const remaining = Math.max(0, plan.totalAmount - paidAmount);
                            const next = plan.installments.find((item) => !item.paidAt);
                            const progress = plan.totalAmount ? Math.min(100, paidAmount / plan.totalAmount * 100) : 0;

                            return (
                                <motion.article
                                    layout key={plan.id}
                                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
                                    transition={{ duration: 0.3, delay: index * 0.05 }}
                                    className="rounded-2xl border bg-card p-5 shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="font-semibold">{plan.name}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{plan.creditAccountName} · Compra: {plan.purchaseName || "Sin descripción"}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Pago previsto: {plan.paymentAccountName || "Se elegirá al registrar la cuota"}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {plan.status === "active" && (
                                                <Button
                                                    size="icon-sm"
                                                    variant="ghost"
                                                    onClick={() => setPlanToCancel(plan)}
                                                    aria-label={`Cancelar ${plan.name}`}
                                                    className="cursor-pointer text-destructive hover:text-destructive"
                                                >
                                                    <Ban />
                                                </Button>
                                            )}
                                            <span
                                                className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${plan.status === "completed"
                                                    ? "bg-emerald-500/10 text-emerald-700"
                                                    : plan.status === "cancelled"
                                                        ? "bg-muted text-muted-foreground"
                                                        : "bg-primary/10 text-primary"}`}
                                            >
                                                {plan.status === "completed" ? "Liquidado" : plan.status === "cancelled" ? "Cancelado" : "Activo"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-muted-foreground">
                                                Saldo pendiente
                                            </p>
                                            <p className="mt-1 text-2xl font-semibold">
                                                {money(remaining, plan.currency)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-muted-foreground">
                                                Progreso
                                            </p>
                                            <p className="mt-1 text-2xl font-semibold">
                                                {paid}/{plan.installments.length}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progress}%` }}
                                            transition={{ duration: 0.45, delay: index * 0.05 }}
                                            className="h-full rounded-full bg-primary"
                                        />
                                    </div>

                                    {next && plan.status === "active" ? (
                                        <div className="mt-5 flex flex-col gap-3 rounded-xl bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-sm font-medium">Próxima cuota {next.isBalloon ? "final" : `#${next.sequence}`}</p>
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {formatAppDate(next.scheduledAt, { day: "numeric", month: "long", year: "numeric" })}{" · "}{money(next.amount, plan.currency)}
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => setInstallmentToPay(next.id)}
                                                disabled={!paymentAccounts.length}
                                                className="cursor-pointer"
                                            >
                                                Registrar pago
                                            </Button>
                                        </div>
                                    ) : plan.status === "cancelled" ? (
                                        <p className="mt-5 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
                                            Este financiamiento fue cancelado. Las cuotas pendientes ya no se programarán.
                                        </p>
                                    ) : (
                                        <p className="mt-5 rounded-xl bg-emerald-500/10 p-4 text-sm text-emerald-700">Este financiamiento está liquidado.</p>
                                    )}

                                    <div className="mt-5 divide-y rounded-xl border">
                                        {plan.installments.map((item) => (
                                            <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                                                <span className="min-w-0 truncate">
                                                    {item.isBalloon ? "Pago final" : `Cuota ${item.sequence}`}
                                                    <span className="ml-2 text-xs text-muted-foreground">{formatAppDate(item.scheduledAt, { day: "numeric", month: "short" })}</span>
                                                </span>
                                                <span className={item.paidAt ? "text-emerald-700 line-through" : "font-medium"}>{money(item.amount, plan.currency)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.article>
                            );
                        })}
                    </AnimatePresence>
                </motion.section>
            )}

            <Dialog
                open={planToCreate !== null}
                onOpenChange={(open) => !open && setPlanToCreate(null)}
            >
                <DialogContent
                    className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-none overflow-y-auto p-6 sm:w-[min(92vw,42rem)] sm:max-w-none"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="font-serif text-2xl">
                                    Nuevo financiamiento
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    El gasto original permanece intacto; sólo se agenda cómo pagarás la deuda.
                                </DialogDescription>
                            </div>
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setPlanToCreate(null)}
                                className="cursor-pointer"
                            >
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    {planToCreate && (
                        <FinancingPlanForm
                            key={planToCreate}
                            purchases={purchases}
                            paymentAccounts={paymentAccounts}
                            onClose={closePlanForm}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={planToCancel !== null}
                onOpenChange={(open) => !open && setPlanToCancel(null)}
            >
                <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-destructive/10 text-destructive">
                            <Ban />
                        </AlertDialogMedia>
                        <AlertDialogTitle>¿Cancelar este financiamiento?</AlertDialogTitle>
                        <AlertDialogDescription className="min-w-0 break-words">
                            {planToCancel
                                ? `Las cuotas pendientes de “${planToCancel.name}” dejarán de programarse. Los pagos ya registrados se conservarán.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:flex-col">
                        <AlertDialogCancel className="w-full" disabled={isCancelling}>Conservar financiamiento</AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={isCancelling}
                            onClick={cancelSelectedPlan}
                            className="w-full"
                        >
                            {isCancelling ? "Cancelando..." : "Cancelar financiamiento"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog
                open={installmentToPay !== null}
                onOpenChange={(open) => !open && setInstallmentToPay(null)}
            >
                <DialogContent
                    className="w-[calc(100vw-2rem)] max-w-none p-6 sm:w-[min(92vw,30rem)] sm:max-w-none"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="font-serif text-2xl">
                                    Registrar pago de cuota
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    El pago reducirá la deuda de la tarjeta mediante una transferencia.
                                </DialogDescription>
                            </div>
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setInstallmentToPay(null)}
                                className="cursor-pointer"
                            >
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    {selectedInstallment && (
                        <FinancingPaymentForm
                            key={selectedInstallment.id}
                            installmentId={selectedInstallment.id}
                            accounts={paymentAccounts}
                            onClose={closePaymentForm}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
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
                <Button onClick={onAction} className="mt-5 cursor-pointer">
                    {actionLabel}
                </Button>
            </div>
        </motion.section>
    );
}
