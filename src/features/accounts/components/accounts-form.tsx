import { useTransition } from "react";
import {
    accountColors,
    accountTypes,
    currencies,
    FinancialAccountInput,
    getAccountColorLabel,
} from "../schemas/financial-account.schema";
import { saveFinancialAccount } from "../actions/financial-account-actions";
import toast from "react-hot-toast";
import { AccountPlastic } from "./accounts-plastic";
import { Button } from "@/src/shared/components/ui/button";
import { ACCOUNT_TYPE_LABELS } from "../constants/account.constants";

const inputClass =
    "h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30";

export function AccountForm({
    draft,
    setDraft,
    onSaved,
    onClose,
}: {
    draft: FinancialAccountInput;
    setDraft: (next: FinancialAccountInput) => void;
    onSaved: () => void;
    onClose: () => void;
}) {
    const [isPending, startTransition] = useTransition();
    const credit = draft.type === "credit";
    const card = draft.type === "credit" || draft.type === "debit";
    const update = <K extends keyof FinancialAccountInput>(
        key: K,
        value: FinancialAccountInput[K],
    ) => setDraft({ ...draft, [key]: value });
    const number = (value: string) => (value === "" ? undefined : Number(value));
    const availableCredit =
        credit && draft.creditLimit !== undefined
            ? Math.max(0, draft.creditLimit - (draft.owedAmount ?? 0))
            : undefined;
    const days = Array.from({ length: 31 }, (_, index) => index + 1);

    function handleTypeChange(type: FinancialAccountInput["type"]) {
        setDraft({
            ...draft,
            type,
            owedAmount: type === "credit" ? (draft.owedAmount ?? 0) : undefined,
            creditLimit: type === "credit" ? draft.creditLimit : undefined,
            availableCredit: undefined,
            billingDate: type === "credit" ? draft.billingDate : undefined,
            dueDate: type === "credit" ? draft.dueDate : undefined,
        });
    }

    function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        startTransition(async () => {
            const result = await saveFinancialAccount(draft);
            if (!result.success) {
                toast.error(result.message);
                return;
            }
            toast.success(result.message);
            onSaved();
            onClose();
        });
    }

    return (
        <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
            <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium">
                        Nombre de la cuenta
                        <input
                            className={inputClass}
                            value={draft.name}
                            onChange={(event) => update("name", event.target.value)}
                            placeholder="Ej. BBVA Nómina"
                            autoFocus
                        />
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                        Institución
                        <input
                            className={inputClass}
                            value={draft.institution ?? ""}
                            onChange={(event) => update("institution", event.target.value)}
                            placeholder="Ej. BBVA"
                        />
                    </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm font-medium">
                        Tipo
                        <select
                            className={inputClass}
                            value={draft.type}
                            onChange={(event) =>
                                handleTypeChange(
                                    event.target.value as FinancialAccountInput["type"],
                                )
                            }
                        >
                            {accountTypes.map((type) => (
                                <option key={type} value={type}>
                                    {ACCOUNT_TYPE_LABELS[type]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-2 text-sm font-medium">
                        Moneda
                        <select
                            className={inputClass}
                            value={draft.currency}
                            onChange={(event) =>
                                update(
                                    "currency",
                                    event.target.value as FinancialAccountInput["currency"],
                                )
                            }
                        >
                            {currencies.map((currency) => (
                                <option key={currency}>{currency}</option>
                            ))}
                        </select>
                    </label>
                </div>
                {!credit && (
                    <label className="block space-y-2 text-sm font-medium">
                        Saldo inicial
                        <input
                            className={inputClass}
                            type="number"
                            step="0.01"
                            value={draft.openingBalance === 0 ? "" : draft.openingBalance}
                            onChange={(event) =>
                                update(
                                    "openingBalance",
                                    event.target.value === "" ? 0 : Number(event.target.value),
                                )
                            }
                            placeholder="0"
                        />
                    </label>
                )}
                {card && (
                    <label className="block space-y-2 text-sm font-medium">
                        Últimos cuatro dígitos
                        <input
                            className={inputClass}
                            value={draft.lastFourDigits ?? ""}
                            onChange={(event) =>
                                update(
                                    "lastFourDigits",
                                    event.target.value.replace(/\D/g, "").slice(0, 4),
                                )
                            }
                            placeholder="1234"
                            inputMode="numeric"
                        />
                    </label>
                )}
                {credit && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="space-y-2 text-sm font-medium">
                            Límite de crédito
                            <input
                                className={inputClass}
                                type="number"
                                step="0.01"
                                value={draft.creditLimit ?? ""}
                                onChange={(event) =>
                                    update("creditLimit", number(event.target.value))
                                }
                            />
                        </label>
                        <label className="space-y-2 text-sm font-medium">
                            Deuda actual
                            <input
                                className={inputClass}
                                type="number"
                                step="0.01"
                                value={draft.owedAmount ?? 0}
                                onChange={(event) =>
                                    update("owedAmount", number(event.target.value))
                                }
                            />
                        </label>
                    </div>
                )}
                {credit && (
                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="space-y-2 text-sm font-medium">
                            Crédito disponible
                            <input
                                className={`${inputClass} bg-muted text-muted-foreground`}
                                value={
                                    availableCredit === undefined
                                        ? "—"
                                        : availableCredit.toFixed(2)
                                }
                                readOnly
                            />
                        </label>
                        <label className="space-y-2 text-sm font-medium">
                            Día de corte
                            <select
                                className={inputClass}
                                value={draft.billingDate ?? ""}
                                onChange={(event) =>
                                    update("billingDate", number(event.target.value))
                                }
                            >
                                <option value="">Sin configurar</option>
                                {days.map((day) => (
                                    <option key={day} value={day}>
                                        {day}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-2 text-sm font-medium">
                            Fecha límite de pago
                            <select
                                className={inputClass}
                                value={draft.dueDate ?? ""}
                                onChange={(event) =>
                                    update("dueDate", number(event.target.value))
                                }
                            >
                                <option value="">Sin configurar</option>
                                {days.map((day) => (
                                    <option key={day} value={day}>
                                        {day}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                )}
                <label className="flex items-center justify-between rounded-xl border p-3 text-sm">
                    <span>
                        <span className="block font-medium">Incluir en patrimonio</span>
                        <span className="text-xs text-muted-foreground">
                            Cuenta para tu patrimonio neto.
                        </span>
                    </span>
                    <input
                        type="checkbox"
                        checked={draft.includeInNetWorth}
                        onChange={(event) =>
                            update("includeInNetWorth", event.target.checked)
                        }
                        className="size-4 accent-primary cursor-pointer"
                    />
                </label>
            </div>
            <aside className="space-y-4 rounded-xl bg-muted/50 p-4">
                <div>
                    <p className="text-sm font-medium">Color de la tarjeta</p>
                    <p className="text-xs text-muted-foreground">
                        {getAccountColorLabel(draft.color)} es el color seleccionado.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {accountColors.map((color) => (
                        <button
                            key={color}
                            type="button"
                            aria-label={`Elegir ${getAccountColorLabel(color)}`}
                            title={getAccountColorLabel(color)}
                            onClick={() => update("color", color)}
                            className={`size-8 rounded-full ring-offset-2 transition ${draft.color === color ? "ring-2 ring-foreground" : "hover:scale-110"}`}
                            style={{ backgroundColor: color, cursor: 'pointer' }}
                        />
                    ))}
                    <label
                        className="relative size-8 cursor-pointer rounded-full bg-[conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#3b82f6,#8b5cf6,#ec4899,#ef4444)] shadow-sm transition hover:scale-110"
                        title="Elegir un color personalizado"
                    >
                        <input
                            type="color"
                            value={draft.color}
                            onChange={(event) => update("color", event.target.value)}
                            className="absolute inset-0 cursor-pointer opacity-0"
                            aria-label="Elegir un color personalizado"
                        />
                    </label>
                </div>
                <AccountPlastic
                    preview
                    account={{
                        name: draft.name || "Mi cuenta",
                        type: draft.type,
                        currency: draft.currency,
                        institution: draft.institution || null,
                        color: draft.color,
                        lastFourDigits: draft.lastFourDigits || null,
                        currentBalance: String(
                            credit ? (draft.owedAmount ?? 0) : draft.openingBalance,
                        ),
                        owedAmount:
                            draft.owedAmount === undefined ? null : String(draft.owedAmount),
                    }}
                />
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose} style={{ cursor: 'pointer' }}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isPending} style={{ cursor: 'pointer' }}>
                        {isPending
                            ? "Guardando..."
                            : draft.id
                                ? "Guardar cambios"
                                : "Crear cuenta"}
                    </Button>
                </div>
            </aside>
        </form>
    );
}
