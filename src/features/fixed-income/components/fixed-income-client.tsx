"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { z } from "zod";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
    CalendarClock, Landmark, Pencil, Plus, ReceiptText, Trash2, Wallet, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from "@/src/shared/components/ui/alert-dialog";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CardTitle } from "@/src/shared/components/ui/card";
import { formatAppDate, millisecondsUntilNextAppDay, toAppDateInputValue } from "@/src/shared/utils/local-date-time";
import {
    addFixedIncomeCapital, cancelFixedIncomePosition, recordDailyFixedIncomeInterest,
    settleFixedIncomePosition, withdrawFixedIncomeCapital,
} from "../actions/fixed-income-actions";
import type { FixedIncomeData } from "../queries/get-fixed-income-data";
import { toFixedIncomeDraft } from "../utils/fixed-income-draft";
import { FixedIncomeFilters, type FixedIncomeFilter } from "./fixed-income-filters";
import { FixedIncomeForm } from "./fixed-income-form";

const money = (amount: number, currency: string) => new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
}).format(amount);

const addCapitalAmountSchema = (availableBalance: number) => z.coerce.number({
    error: "Ingresa un monto válido.",
}).finite("Ingresa un monto válido.")
    .positive("El aporte debe ser mayor que cero.")
    .max(availableBalance, "El aporte no puede superar el saldo disponible en la cuenta de fondeo.");

export function FixedIncomeClient({ liquidAccounts, positions }: FixedIncomeData) {
    const router = useRouter();
    const [positionToEdit, setPositionToEdit] = useState<FixedIncomeData["positions"][number] | "new" | null>(null);
    const [positionToCancel, setPositionToCancel] = useState<FixedIncomeData["positions"][number] | null>(null);
    const [positionToWithdraw, setPositionToWithdraw] = useState<FixedIncomeData["positions"][number] | null>(null);
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [positionToAddCapital, setPositionToAddCapital] = useState<FixedIncomeData["positions"][number] | null>(null);
    const [addCapitalAmount, setAddCapitalAmount] = useState("");
    const addCapitalFundingAccount = liquidAccounts.find((account) => account.id === positionToAddCapital?.fundingAccountId);
    const addCapitalError = useMemo(() => {
        if (!positionToAddCapital || !addCapitalAmount) return null;
        const result = addCapitalAmountSchema(addCapitalFundingAccount?.currentBalance ?? 0).safeParse(addCapitalAmount);
        return result.success ? null : result.error.issues[0]?.message ?? "Monto inválido.";
    }, [addCapitalAmount, addCapitalFundingAccount, positionToAddCapital]);
    const [statusFilter, setStatusFilter] = useState<FixedIncomeFilter>("active");
    const [backdatePositionId, setBackdatePositionId] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const active = positions.filter((position) => (
        position.status === "active" || position.status === "matured"
    ));
    const total = active.reduce((sum, position) => sum + position.outstandingPrincipal, 0);
    const accrued = active.reduce((sum, position) => sum + position.estimatedNet, 0);
    const today = new Date();
    const visiblePositions = positions.filter((position) => {
        if (statusFilter === "all") return true;
        if (statusFilter === "active") return position.status === "active" || position.status === "matured";
        return position.status === statusFilter;
    });

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        const refreshAtNextDay = () => {
            timeoutId = setTimeout(() => {
                router.refresh();
                refreshAtNextDay();
            }, millisecondsUntilNextAppDay());
        };

        refreshAtNextDay();
        return () => clearTimeout(timeoutId);
    }, [router]);

    function registerDaily(positionId: string, occurredAt: Date = today) {
        startTransition(async () => {
            const result = await recordDailyFixedIncomeInterest({
                positionId,
                occurredAt,
            });

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            setBackdatePositionId(null);
            router.refresh();
        });
    }

    function settle(positionId: string) {
        startTransition(async () => {
            const result = await settleFixedIncomePosition({
                positionId,
                occurredAt: today,
            });

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            router.refresh();
        });
    }

    function withdraw() {
        if (!positionToWithdraw) return;
        const amount = Number(withdrawAmount);
        startTransition(async () => {
            const result = await withdrawFixedIncomeCapital({
                positionId: positionToWithdraw.id,
                amount,
                occurredAt: today,
            });
            if (!result.success) {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            setPositionToWithdraw(null);
            setWithdrawAmount("");
            router.refresh();
        });
    }

    function addCapital() {
        if (!positionToAddCapital || addCapitalError) return;
        const amount = Number(addCapitalAmount);
        startTransition(async () => {
            const result = await addFixedIncomeCapital({
                positionId: positionToAddCapital.id,
                amount,
                occurredAt: today,
            });
            if (!result.success) {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            setPositionToAddCapital(null);
            setAddCapitalAmount("");
            router.refresh();
        });
    }

    function cancelPosition() {
        if (!positionToCancel) return;

        startTransition(async () => {
            const result = await cancelFixedIncomePosition({
                positionId: positionToCancel.id,
                occurredAt: today,
            });

            if (!result.success) {
                toast.error(result.message);
                return;
            }

            toast.success(result.message);
            setPositionToCancel(null);
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
                        Capital protegido y rendimiento calculado
                    </p>
                    <CardTitle className="font-serif text-4xl tracking-[-0.04em] sm:text-5xl">
                        Renta fija
                    </CardTitle>
                    <p className="max-w-2xl text-muted-foreground">
                        El capital se transfiere, no se gasta. El rendimiento se registra como
                        ingreso sólo cuando llega a tu cuenta líquida.
                    </p>
                </div>
                <Button
                    size="lg"
                    onClick={() => setPositionToEdit("new")}
                    disabled={!liquidAccounts.length}
                    className="cursor-pointer"
                >
                    <Plus />
                    Nueva inversión
                </Button>
            </motion.header>

            <motion.section
                initial="hidden"
                animate="visible"
                variants={{
                    hidden: {},
                    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.08 } },
                }}
                className="grid gap-4 sm:grid-cols-3"
            >
                {[
                    { label: "Capital invertido", value: total.toLocaleString("es-MX", { maximumFractionDigits: 2 }) },
                    { label: "Interés neto estimado", value: accrued.toLocaleString("es-MX", { maximumFractionDigits: 2 }) },
                    { label: "Posiciones activas", value: String(active.length) },
                ].map((item) => (
                    <motion.article
                        key={item.label}
                        variants={{
                            hidden: { opacity: 0, y: 16 },
                            visible: { opacity: 1, y: 0 },
                        }}
                        className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                    >
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                    </motion.article>
                ))}
            </motion.section>

            {!positions.length ? (
                <motion.section
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.16 }}
                    className="grid min-h-72 place-items-center rounded-2xl border border-dashed bg-muted/25 p-8 text-center"
                >
                    <div className="max-w-md">
                        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
                            <Landmark />
                        </span>
                        <h2 className="mt-5 text-xl font-semibold">Registra tu primera inversión</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Define tasa anual, plazo y la cuenta líquida que recibirá los rendimientos.
                        </p>
                        <Button
                            className="mt-5 cursor-pointer"
                            onClick={() => setPositionToEdit("new")}
                            disabled={!liquidAccounts.length}
                        >
                            <Plus />
                            Crear inversión
                        </Button>
                    </div>
                </motion.section>
            ) : (
                <>
                    <FixedIncomeFilters value={statusFilter} onChange={setStatusFilter} />
                    {!visiblePositions.length ? (
                        <section className="grid min-h-52 place-items-center rounded-2xl border border-dashed bg-muted/25 p-8 text-center">
                            <div>
                                <h2 className="text-lg font-semibold">
                                    No hay cajitas {statusFilter === "cancelled" ? "canceladas" : "liquidadas"}
                                </h2>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Las cajitas con este estado aparecerán aquí.
                                </p>
                            </div>
                        </section>
                    ) : (
                        <motion.section layout className="grid gap-5 xl:grid-cols-2">
                            <AnimatePresence mode="popLayout">
                                {visiblePositions.map((position, index) => (
                            <motion.article
                                layout
                                key={position.id}
                                initial={{ opacity: 0, y: 18 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ duration: 0.3, delay: index * 0.05 }}
                                className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-lg"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h2 className="font-semibold">{position.name}</h2>
                                        <p className="mt-1 text-xs text-muted-foreground">
                                            {position.institution || "Sin institución"} · {position.accountName}
                                        </p>
                                        <p className="mt-2 text-xs font-medium text-primary">
                                            {position.isAvailableOnDemand
                                                ? "Cajita disponible al instante"
                                                : "Inversión a plazo"}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {position.status === "active" && (
                                            <Button
                                                size="icon-sm"
                                                variant="ghost"
                                                onClick={() => setPositionToEdit(position)}
                                                aria-label={`Editar ${position.name}`}
                                                className="cursor-pointer"
                                            >
                                                <Pencil />
                                            </Button>
                                        )}
                                        {position.status === "active" && (
                                            <Button
                                                size="icon-sm"
                                                variant="ghost"
                                                disabled={isPending}
                                                onClick={() => setPositionToCancel(position)}
                                                aria-label={`Cancelar ${position.name}`}
                                                className="cursor-pointer text-destructive hover:text-destructive"
                                            >
                                                <Trash2 />
                                            </Button>
                                        )}
                                        <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
                                            {position.status === "settled"
                                                ? "Liquidada"
                                                : position.status === "active"
                                                    ? "Activa"
                                                    : position.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-5 grid grid-cols-2 gap-4">
                                    <Metric label="Capital" value={money(position.outstandingPrincipal, position.currency)} />
                                    <Metric label="Valor estimado" value={money(position.estimatedValue, position.currency)} />
                                    <Metric
                                        label="Tasa anual"
                                        value={`${(position.annualRate * 100).toFixed(2)}% · ${position.dayCountConvention === "actual_360" ? "Actual/360" : "Actual/365"}`}
                                    />
                                    <Metric
                                        label="Vencimiento"
                                        value={position.maturesAt
                                            ? formatAppDate(position.maturesAt, {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                            })
                                            : "Sin vencimiento"}
                                    />
                                </div>

                                <p className="mt-4 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                                    Rendimiento estimado sin confirmar: bruto {money(position.estimatedGross, position.currency)}
                                    {" · "}retención {money(position.estimatedTax, position.currency)}
                                    {" · "}neto {money(position.estimatedNet, position.currency)}.
                                </p>

                                {position.interestFrequency === "daily" && !position.hasConfirmedInterestToday && (
                                    <p className="mt-3 text-xs text-muted-foreground">
                                        Hoy se estima un abono neto de {money(position.estimatedDailyNet, position.currency)}.
                                        Confírmalo sólo cuando Nu o tu banco realmente lo deposite.
                                    </p>
                                )}

                                {position.status === "active" && (
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={
                                                isPending
                                                || position.interestFrequency !== "daily"
                                                || position.hasConfirmedInterestToday
                                            }
                                            onClick={() => registerDaily(position.id)}
                                            className="cursor-pointer"
                                        >
                                            <ReceiptText />
                                            {position.hasConfirmedInterestToday
                                                ? "Abono de hoy confirmado"
                                                : "Confirmar abono de hoy"}
                                        </Button>
                                        {position.interestFrequency === "daily" && (
                                            <Popover
                                                open={backdatePositionId === position.id}
                                                onOpenChange={(open) => setBackdatePositionId(open ? position.id : null)}
                                            >
                                                <PopoverTrigger
                                                    render={
                                                        <Button
                                                            size="icon-sm"
                                                            variant="outline"
                                                            disabled={isPending}
                                                            aria-label={`Confirmar abono de un día anterior para ${position.name}`}
                                                            className="cursor-pointer"
                                                        />
                                                    }
                                                >
                                                    <CalendarClock />
                                                </PopoverTrigger>
                                                <PopoverContent align="start" className="w-72 p-0">
                                                    <div className="border-b p-3">
                                                        <p className="text-sm font-medium">Confirmar abono de otro día</p>
                                                        <p className="mt-1 text-xs text-muted-foreground">
                                                            Elige el día pendiente en que Nu o tu banco realmente depositó el rendimiento.
                                                        </p>
                                                    </div>
                                                    <Calendar
                                                        mode="single"
                                                        selected={undefined}
                                                        onSelect={(date) => date && registerDaily(position.id, date)}
                                                        disabled={(date) => date < startOfDay(position.startsAt)
                                                            || date > startOfDay(today)
                                                            || position.confirmedInterestDates.includes(toAppDateInputValue(date))}
                                                        defaultMonth={today}
                                                        autoFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={isPending}
                                            onClick={() => (setPositionToAddCapital(position), setAddCapitalAmount(""))}
                                            className="cursor-pointer"
                                        >
                                            <Wallet />
                                            Aportar capital
                                        </Button>
                                        <Button
                                            size="sm"
                                            disabled={isPending}
                                            onClick={() => position.isAvailableOnDemand
                                                ? (setPositionToWithdraw(position), setWithdrawAmount(position.outstandingPrincipal.toFixed(2)))
                                                : settle(position.id)}
                                            className="cursor-pointer"
                                        >
                                            {position.isAvailableOnDemand ? "Retirar capital" : "Liquidar"}
                                        </Button>
                                        {position.interestFrequency !== "daily" && (
                                            <span className="text-xs text-muted-foreground">
                                                Los pagos diarios se habilitan al elegir frecuencia diaria.
                                            </span>
                                        )}
                                    </div>
                                )}
                            </motion.article>
                                ))}
                            </AnimatePresence>
                        </motion.section>
                    )}
                </>
            )}

            <Dialog
                open={positionToEdit !== null}
                onOpenChange={(open) => !open && setPositionToEdit(null)}
            >
                <DialogContent
                    className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-none overflow-y-auto p-6 sm:w-[min(92vw,42rem)] sm:max-w-none"
                    showCloseButton={false}
                >
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="font-serif text-2xl">
                                    {positionToEdit === "new" ? "Nueva inversión de renta fija" : "Editar cajita"}
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    {positionToEdit === "new"
                                        ? "Configura el plazo y la tasa anual. El capital se transferirá sin registrarse como gasto."
                                        : "Actualiza la información operativa sin alterar los movimientos ya registrados."}
                                </DialogDescription>
                            </div>
                            <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => setPositionToEdit(null)}
                                className="cursor-pointer"
                            >
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    {positionToEdit && (
                        <FixedIncomeForm
                            key={positionToEdit === "new" ? "new" : positionToEdit.id}
                            accounts={liquidAccounts}
                            initialValues={positionToEdit === "new" ? undefined : toFixedIncomeDraft(positionToEdit)}
                            positionId={positionToEdit === "new" ? undefined : positionToEdit.id}
                            onClose={() => {
                                setPositionToEdit(null);
                                router.refresh();
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={positionToWithdraw !== null}
                onOpenChange={(open) => !open && setPositionToWithdraw(null)}
            >
                <DialogContent className="w-[calc(100vw-2rem)] max-w-md p-6" showCloseButton={false}>
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="font-serif text-2xl">Retirar capital</DialogTitle>
                                <DialogDescription className="mt-1">
                                    {positionToWithdraw
                                        ? `Retira dinero de “${positionToWithdraw.name}” a su cuenta de débito de origen.`
                                        : ""}
                                </DialogDescription>
                            </div>
                            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setPositionToWithdraw(null)} className="cursor-pointer">
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    {positionToWithdraw && (
                        <form
                            className="mt-4 space-y-5"
                            onSubmit={(event) => {
                                event.preventDefault();
                                withdraw();
                            }}
                        >
                            <div className="space-y-2">
                                <label htmlFor="withdraw-amount" className="text-sm font-medium">Monto a retirar</label>
                                <Input
                                    id="withdraw-amount"
                                    type="number"
                                    min="0.01"
                                    max={positionToWithdraw.outstandingPrincipal}
                                    step="0.01"
                                    value={withdrawAmount}
                                    onChange={(event) => setWithdrawAmount(event.target.value)}
                                    autoFocus
                                />
                                <p className="text-xs text-muted-foreground">
                                    Disponible: {money(positionToWithdraw.outstandingPrincipal, positionToWithdraw.currency)}
                                </p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setPositionToWithdraw(null)} className="cursor-pointer">Cancelar</Button>
                                <Button type="submit" disabled={isPending} className="cursor-pointer">
                                    {isPending ? "Retirando..." : "Confirmar retiro"}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog
                open={positionToAddCapital !== null}
                onOpenChange={(open) => !open && setPositionToAddCapital(null)}
            >
                <DialogContent className="w-[calc(100vw-2rem)] max-w-md p-6" showCloseButton={false}>
                    <DialogHeader>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <DialogTitle className="font-serif text-2xl">Aportar capital</DialogTitle>
                                <DialogDescription className="mt-1">
                                    {positionToAddCapital
                                        ? `Agrega dinero a “${positionToAddCapital.name}” desde su cuenta de fondeo de origen.`
                                        : ""}
                                </DialogDescription>
                            </div>
                            <Button type="button" size="icon-sm" variant="ghost" onClick={() => setPositionToAddCapital(null)} className="cursor-pointer">
                                <X />
                                <span className="sr-only">Cerrar</span>
                            </Button>
                        </div>
                    </DialogHeader>
                    {positionToAddCapital && (
                        <form
                            className="mt-4 space-y-5"
                            onSubmit={(event) => {
                                event.preventDefault();
                                addCapital();
                            }}
                        >
                            <div className="space-y-2 rounded-xl border bg-muted/30 p-3 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">Saldo actual de la cajita</span>
                                    <span className="font-medium">
                                        {money(positionToAddCapital.outstandingPrincipal, positionToAddCapital.currency)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">Cuenta de fondeo</span>
                                    <span className="font-medium">
                                        {addCapitalFundingAccount?.name ?? "Cuenta no disponible"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-muted-foreground">Saldo disponible</span>
                                    <span className="font-medium">
                                        {addCapitalFundingAccount
                                            ? money(addCapitalFundingAccount.currentBalance, addCapitalFundingAccount.currency)
                                            : "—"}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="add-capital-amount" className="text-sm font-medium">Monto a aportar</label>
                                <Input
                                    id="add-capital-amount"
                                    type="number"
                                    min="0.01"
                                    max={addCapitalFundingAccount?.currentBalance}
                                    step="0.01"
                                    value={addCapitalAmount}
                                    onChange={(event) => setAddCapitalAmount(event.target.value)}
                                    aria-invalid={Boolean(addCapitalError)}
                                    autoFocus
                                />
                                {addCapitalError && (
                                    <p className="text-xs text-destructive">{addCapitalError}</p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setPositionToAddCapital(null)} className="cursor-pointer">Cancelar</Button>
                                <Button
                                    type="submit"
                                    disabled={isPending || !addCapitalAmount || Boolean(addCapitalError) || !addCapitalFundingAccount}
                                    className="cursor-pointer"
                                >
                                    {isPending ? "Aportando..." : "Confirmar aporte"}
                                </Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog
                open={positionToCancel !== null}
                onOpenChange={(open) => !open && setPositionToCancel(null)}
            >
                <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-sm">
                    <AlertDialogHeader>
                        <AlertDialogMedia className="bg-destructive/10 text-destructive">
                            <Trash2 />
                        </AlertDialogMedia>
                        <AlertDialogTitle>¿Cancelar esta cajita?</AlertDialogTitle>
                        <AlertDialogDescription className="min-w-0 break-words">
                            {positionToCancel
                                ? `El capital de “${positionToCancel.name}” regresará a tu cuenta receptora. Los abonos que ya confirmaste se conservarán.`
                                : ""}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:flex-col">
                        <AlertDialogCancel className="w-full cursor-pointer" disabled={isPending}>
                            Conservar cajita
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={isPending}
                            onClick={cancelPosition}
                            className="w-full cursor-pointer"
                        >
                            {isPending ? "Cancelando..." : "Cancelar y devolver capital"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function startOfDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function Metric({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-medium">{value}</p>
        </div>
    );
}
