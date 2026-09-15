import { describe, expect, it } from "vitest";
import {
    summarizeTransactionsByAccount, summarizeTransactionsByCurrency,
} from "./transaction-summary";

const transactions: Parameters<typeof summarizeTransactionsByAccount>[0] = [
    { accountId: "debit", accountName: "Débito", amount: "100", currency: "MXN", status: "completed", type: "income", transferDirection: null, financingPlanId: null },
    { accountId: "debit", accountName: "Débito", amount: "25", currency: "MXN", status: "completed", type: "expense", transferDirection: null, financingPlanId: null },
    { accountId: "card", accountName: "Tarjeta", amount: "70", currency: "MXN", status: "completed", type: "expense", transferDirection: null, financingPlanId: null },
    { accountId: "card", accountName: "Tarjeta", amount: "30", currency: "MXN", status: "cancelled", type: "expense", transferDirection: null, financingPlanId: null },
    { accountId: "card", accountName: "Tarjeta", amount: "1200", currency: "MXN", status: "completed", type: "expense", transferDirection: null, financingPlanId: "plan-1" },
];

describe("transaction summary", () => {
    it("agrupa el impacto neto por cuenta y excluye cancelados", () => {
        expect(summarizeTransactionsByAccount(transactions)).toEqual([
            { accountId: "debit", accountName: "Débito", currency: "MXN", total: 75 },
            { accountId: "card", accountName: "Tarjeta", currency: "MXN", total: -70 },
        ]);
    });

    it("consolida los totales por moneda", () => {
        expect(summarizeTransactionsByCurrency(summarizeTransactionsByAccount(transactions))).toEqual({ MXN: 5 });
    });
});
