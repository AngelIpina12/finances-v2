export function formatMoney(value: number, currency: string, hide = false) {
    return hide
        ? "••••••"
        : new Intl.NumberFormat("es-MX", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(value);
}
