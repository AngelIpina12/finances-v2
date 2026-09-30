import type { Currency } from "@/src/features/transactions/domain/transaction-repository";
import type { ForecastAccount, ForecastEvent } from "./forecast-calculator";

export type LinkedSavings = {
    positionId: string;
    accountId: string;
    name: string;
    currency: Currency;
    balance: number;
};

export type LinkedSavingsMode = "exclude" | "principal" | "with_yield";

/**
 * Ajusta cuentas y eventos según cómo se quieran contemplar las cajitas
 * ligadas a cada cuenta de fondeo:
 * - exclude: la cuenta sólo muestra su propio saldo; el rendimiento se queda
 *   en la cajita y no mueve la cuenta.
 * - principal: el saldo actual de la cajita se suma a la cuenta.
 * - with_yield: además, el rendimiento diario proyectado se suma a la cuenta.
 */
export function applyLinkedSavings(input: {
    accounts: ForecastAccount[];
    events: ForecastEvent[];
    savings: LinkedSavings[];
    mode: LinkedSavingsMode;
}) {
    const includeSavings = input.mode !== "exclude";
    const balancesByAccount = new Map<string, number>();
    for (const saving of input.savings) {
        balancesByAccount.set(saving.accountId, (balancesByAccount.get(saving.accountId) ?? 0) + saving.balance);
    }

    const accounts = input.accounts.map((account) => {
        const linkedSavingsBalance = balancesByAccount.get(account.id);
        if (!includeSavings || linkedSavingsBalance === undefined) return account;

        return {
            ...account,
            currentBalance: account.currentBalance + linkedSavingsBalance,
            linkedSavingsBalance,
        };
    });

    const events = input.events.filter((event) => {
        if (!event.linkedSavings) return true;
        if (event.linkedSavings.kind === "yield") return input.mode === "with_yield";
        // Al contemplar la cajita, su capital ya se sumó a la cuenta de fondeo;
        // proyectar también su devolución al vencimiento lo contaría dos veces.
        return !includeSavings;
    });

    return { accounts, events };
}
