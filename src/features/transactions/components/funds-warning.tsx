import { TriangleAlert } from "lucide-react";
import type { FundsImpact } from "../domain/transaction-rules";

function formatCurrency(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export function FundsWarning({
    impact,
    currency,
    scheduled = false,
}: {
    impact: FundsImpact;
    currency: string;
    scheduled?: boolean;
}) {
    const isCredit = impact.kind === "credit_limit";
    const shortfall = formatCurrency(impact.projectedShortfall, currency);

    return (
        <div
            role="status"
            className="flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-amber-950 dark:text-amber-100"
        >
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-sm">
                <p className="font-semibold">
                    {isCredit
                        ? `Superaría el límite por ${shortfall}`
                        : `La cuenta quedaría en -${shortfall}`}
                </p>
                <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/75">
                    {scheduled
                        ? `Puedes programarlo porque ${isCredit ? "tu crédito" : "el saldo"} podría cambiar antes de esa fecha. Al completarlo volveremos a comprobarlo.`
                        : `Podrás registrarlo de todos modos después de confirmar expresamente ${isCredit ? "el exceso" : "el saldo negativo"}.`}
                </p>
            </div>
        </div>
    );
}
