"use client";

import { motion } from "framer-motion";
import {
    ArrowDownLeft, ArrowLeftRight, ArrowUpRight,
    Ellipsis, Pencil, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/src/shared/components/ui/dropdown-menu";
import { formatAppDateTime } from "@/src/shared/utils/local-date-time";
import type { TransactionListItem } from "../queries/get-transaction-data";

const money = (amount: string, currency: string) => new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
}).format(Number(amount));

interface Props {
    transactions: TransactionListItem[];
    onEdit: (transaction: TransactionListItem) => void;
    onCancel: (transaction: TransactionListItem) => void;
}

export function TransactionList({ transactions, onEdit, onCancel }: Props) {
    return (
        <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border bg-card"
        >
            <div className="divide-y">
                {transactions.map((item, index) => {
                    const cancelled = item.status === "cancelled";
                    const transfer = item.type === "transfer";
                    const income = item.type === "income"
                        || (transfer && item.transferDirection === "in");
                    const Icon = transfer
                        ? ArrowLeftRight
                        : income
                            ? ArrowUpRight
                            : ArrowDownLeft;
                    const title = transfer
                        ? item.merchant || "Transferencia entre cuentas"
                        : item.merchant || item.categoryName || "Movimiento";
                    const detail = transfer
                        ? `${item.transferDirection === "in" ? "Recibida en" : "Enviada desde"} ${item.accountName}`
                        : `${item.categoryName || "Sin categoría"} · ${item.accountName}`;

                    return (
                        <motion.article
                            key={item.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: cancelled ? 0.55 : 1, x: 0 }}
                            transition={{ delay: Math.min(index, 8) * 0.035 }}
                            className="flex items-center gap-3 p-4 sm:p-5"
                        >
                            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${transfer
                                ? "bg-sky-500/10 text-sky-600"
                                : income
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : "bg-rose-500/10 text-rose-600"
                                }`}
                            >
                                <Icon className="size-5" />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <p className={`truncate font-medium ${cancelled ? "line-through" : ""}`}>
                                        {title}
                                    </p>
                                    {cancelled && (
                                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Cancelado
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                    {detail} · {formatAppDateTime(item.date)}
                                </p>
                            </div>
                            <p className={`shrink-0 text-sm font-semibold ${income && !transfer
                                ? "text-emerald-600"
                                : transfer
                                    ? "text-sky-600"
                                    : "text-foreground"
                                }`}
                            >
                                {income ? "+" : "-"}
                                {money(item.amount, item.currency)}
                            </p>
                            {!cancelled && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        render={(
                                            <Button type="button" size="icon-sm" variant="ghost" className="cursor-pointer">
                                                <Ellipsis />
                                                <span className="sr-only">Acciones</span>
                                            </Button>
                                        )}
                                    />
                                    <DropdownMenuContent align="end" className="min-w-40">
                                        {!transfer && (
                                            <DropdownMenuItem onClick={() => onEdit(item)} className="cursor-pointer">
                                                <Pencil />
                                                Editar
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                            variant="destructive"
                                            onClick={() => onCancel(item)}
                                            className="cursor-pointer"
                                        >
                                            <XCircle />
                                            Cancelar
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </motion.article>
                    );
                })}
            </div>
        </motion.section>
    );
}
