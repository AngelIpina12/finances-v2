import type { FinancialAccountFormData } from "../schemas/financial-account.schema";
import {
    Banknote, Building2, CreditCard,
    Landmark, WalletCards,
} from "lucide-react";
import { formatMoney } from "../utils/format-account-money";
import { ACCOUNT_TYPE_LABELS } from "../constants/account.constants";

const icons = {
    cash: Banknote,
    debit: Landmark,
    credit: CreditCard,
    wallet: WalletCards,
    investment: Landmark,
    fixed_income: Landmark,
    loan: Building2,
};

export type AccountPlasticViewModel = {
    name: string;
    institution?: string | null;
    type: FinancialAccountFormData["type"];
    color?: string | null;
    lastFourDigits?: string | null;
    currentBalance: string | number;
    currency: FinancialAccountFormData["currency"];
    owedAmount?: string | number | null;
};

function darkenHexColor(color: string, amount = 0.56) {
    const hex = color.replace("#", "");

    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return "#0f172a";

    const channel = (offset: number) =>
        Math.round(parseInt(hex.slice(offset, offset + 2), 16) * (1 - amount))
            .toString(16)
            .padStart(2, "0");

    return `#${channel(0)}${channel(2)}${channel(4)}`;
}

interface Props {
    account: AccountPlasticViewModel;
    hideBalance?: boolean;
    preview?: boolean;
}

export function AccountPlastic({ account, hideBalance = false, preview = false }: Props) {
    const Icon = icons[account.type];
    const balance =
        account.type === "credit"
            ? -Number(account.owedAmount ?? account.currentBalance)
            : Number(account.currentBalance);
    const baseColor = account.color || "#2563eb";
    const darkerColor = darkenHexColor(baseColor);
    return (
        <div
            style={{
                background: `linear-gradient(135deg, ${baseColor}, ${darkerColor})`,
            }}
            className="aspect-[1.586/1] w-full rounded-2xl p-5 text-white shadow-xl shadow-black/20"
        >
            <div className="flex items-center justify-between text-xs font-semibold tracking-[0.18em]">
                <span>
                    {account.institution?.toUpperCase() ||
                        ACCOUNT_TYPE_LABELS[account.type].toUpperCase()}
                </span>
                <Icon className="size-6" />
            </div>
            <div className="mt-7">
                <p className="text-xs text-white/70">
                    {account.type === "credit" ? "Deuda actual" : "Saldo disponible"}
                </p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                    {formatMoney(Math.abs(balance), account.currency, hideBalance)}
                </p>
            </div>
            <div className="mt-6 flex items-end justify-between">
                <p className="text-sm tracking-[0.18em]">
                    {account.lastFourDigits
                        ? `•••• ${account.lastFourDigits}`
                        : "CUENTA DIGITAL"}
                </p>
                <span className="text-xs font-medium">
                    {preview ? "PREVIEW" : "FINANCES"}
                </span>
            </div>
        </div>
    );
}
