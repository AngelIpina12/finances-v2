const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Formats a Date for an <input type="datetime-local"> without converting it to UTC.
 */
export function toLocalDateTimeInputValue(date = new Date()) {
    return [
        date.getFullYear(),
        "-",
        pad(date.getMonth() + 1),
        "-",
        pad(date.getDate()),
        "T",
        pad(date.getHours()),
        ":",
        pad(date.getMinutes()),
    ].join("");
}

/**
 * Parses the value from an <input type="datetime-local"> in the browser's timezone.
 * The resulting Date is serialized as UTC when sent to the server.
 */
export function fromLocalDateTimeInputValue(value: string) {
    if (!value) return undefined;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Formats a Date for an <input type="date"> using the local calendar day.
 * Keep this value as YYYY-MM-DD when the database column represents a date only.
 */
export function toLocalDateInputValue(date = new Date()) {
    return [
        date.getFullYear(),
        "-",
        pad(date.getMonth() + 1),
        "-",
        pad(date.getDate()),
    ].join("");
}

/**
 * Displays a stored UTC timestamp in the user's local browser timezone.
 */
export function formatLocalDateTime(
    value: Date | string | number,
    options: Intl.DateTimeFormatOptions = {},
    locale = "es-MX",
) {
    return new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        ...options,
    }).format(new Date(value));
}
