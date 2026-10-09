export const formatMoney = (amount: number, currency = "MXN") => new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
}).format(amount);

export const formatPercent = (percent: number) => `${percent.toLocaleString("es-MX", { maximumFractionDigits: 2 })}%`;

export const formatLoanDate = (isoDate: string) => new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
}).format(new Date(`${isoDate}T00:00:00Z`));
