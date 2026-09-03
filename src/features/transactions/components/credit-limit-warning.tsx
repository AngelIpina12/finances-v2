import { TriangleAlert } from "lucide-react";
import type { CreditLimitImpact } from "../domain/transaction-rules";

function formatCurrency(value: number, currency: string) {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export function CreditLimitWarning({
    impact,
    currency,
    scheduled = false,
}: {
    impact: CreditLimitImpact;
    currency: string;
    scheduled?: boolean;
}) {
    return (
        <div
            role="status"
            className="flex gap-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-amber-950 dark:text-amber-100"
        >
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-sm">
                <p className="font-semibold">
                    Superaría el límite por {formatCurrency(
                        impact.projectedOverLimit,
                        currency,
                    )}
                </p>
                <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/75">
                    {scheduled
                        ? "Puedes programarlo porque tu crédito podría cambiar antes de esa fecha. Al completarlo volveremos a comprobarlo."
                        : "Podrás registrarlo de todos modos después de confirmar expresamente el exceso."}
                </p>
            </div>
        </div>
    );
}
