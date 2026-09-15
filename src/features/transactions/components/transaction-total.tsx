import { ArrowDownRight, ArrowUpRight, WalletCards } from "lucide-react";
import type { TransactionListItem } from "../queries/get-transaction-data";
import {
    summarizeTransactionsByAccount, summarizeTransactionsByCurrency,
} from "../domain/transaction-summary";

function money(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency", currency, maximumFractionDigits: 2,
    }).format(value);
}

function TotalValue({ value, currency }: { value: number; currency: string }) {
    const positive = value > 0;
    const negative = value < 0;
    const Icon = positive ? ArrowUpRight : ArrowDownRight;

    return (
        <span className={`inline-flex items-center gap-1 font-semibold ${positive
            ? "text-emerald-600"
            : negative
                ? "text-rose-600"
                : "text-muted-foreground"}`}
        >
            <Icon className="size-4" />
            {money(Math.abs(value), currency)}
        </span>
    );
}

export function TransactionTotal({ transactions }: { transactions: TransactionListItem[] }) {
    const accountTotals = summarizeTransactionsByAccount(transactions);
    const currencyTotals = summarizeTransactionsByCurrency(accountTotals);
    const multipleAccounts = accountTotals.length > 1;

    if (!accountTotals.length) return null;

    return (
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
                <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                        <WalletCards className="size-5" />
                    </span>
                    <div>
                        <p className="font-medium">Actividad neta</p>
                        <p className="text-xs text-muted-foreground">
                            {multipleAccounts ? "Desglose por cuenta" : accountTotals[0]!.accountName}
                        </p>
                    </div>
                </div>
                {!multipleAccounts && (
                    <TotalValue value={accountTotals[0]!.total} currency={accountTotals[0]!.currency} />
                )}
            </div>

            {multipleAccounts && (
                <>
                    <div className="grid divide-y border-t sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                        {accountTotals.map((account) => (
                            <div key={account.accountId} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                                <span className="truncate text-sm text-muted-foreground">{account.accountName}</span>
                                <TotalValue value={account.total} currency={account.currency} />
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t bg-muted/40 px-4 py-3 sm:px-5">
                        <span className="text-sm font-medium">Total neto</span>
                        <div className="flex flex-wrap gap-x-5 gap-y-1">
                            {Object.entries(currencyTotals).map(([currency, total]) => (
                                <TotalValue key={currency} value={total} currency={currency} />
                            ))}
                        </div>
                    </div>
                </>
            )}
        </section>
    );
}
