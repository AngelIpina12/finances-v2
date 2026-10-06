import type { ForecastGranularity } from "./forecast-calculator";
import type { LinkedSavingsMode } from "./linked-savings";
export type ForecastViewAccountKind = "all" | "debit" | "credit";
export type ForecastViewChartView = "balance" | "flows" | "savings" | "yields";

export type ForecastViewSettings = {
    rangePresetDays: number | null;
    startsOn: string | null;
    endsOn: string | null;
    currency: string;
    accountKind: ForecastViewAccountKind;
    accountIds: string[];
    granularity: ForecastGranularity;
    savingsMode: LinkedSavingsMode;
    chartView: ForecastViewChartView;
    savingsSimulationId: string | null;
};

export type SavedForecastView = ForecastViewSettings & {
    id: string;
    name: string;
    isDefault: boolean;
};

const clampDate = (value: string, min: string, max: string) => value < min ? min : value > max ? max : value;

export function resolveForecastViewRange(
    view: Pick<ForecastViewSettings, "rangePresetDays" | "startsOn" | "endsOn">,
    { minimumDate, maximumDate, addDays }: {
        minimumDate: string;
        maximumDate: string;
        addDays: (date: string, days: number) => string;
    },
) {
    if (view.rangePresetDays !== null || !view.startsOn || !view.endsOn) {
        const days = view.rangePresetDays ?? 30;
        return { startsOn: minimumDate, endsOn: clampDate(addDays(minimumDate, days), minimumDate, maximumDate), preset: days };
    }

    const lastStart = addDays(maximumDate, -1);
    const startsOn = clampDate(view.startsOn, minimumDate, lastStart);
    const endsOn = clampDate(view.endsOn, addDays(startsOn, 1), maximumDate);
    return { startsOn, endsOn, preset: null };
}

export type ForecastViewDraft = ForecastViewSettings & { startsOn: string; endsOn: string };

export function matchesAccountKind(type: string, kind: ForecastViewAccountKind) {
    if (kind === "all") return true;
    if (kind === "credit") return type === "credit";
    return type === "debit" || type === "cash" || type === "wallet";
}

export function isSameForecastViewSettings(view: ForecastViewSettings, draft: ForecastViewDraft) {
    const sameRange = view.rangePresetDays === null
        ? draft.rangePresetDays === null && view.startsOn === draft.startsOn && view.endsOn === draft.endsOn
        : view.rangePresetDays === draft.rangePresetDays;

    return sameRange
        && view.currency === draft.currency
        && view.accountKind === draft.accountKind
        && [...view.accountIds].sort().join() === [...draft.accountIds].sort().join()
        && view.granularity === draft.granularity
        && view.savingsMode === draft.savingsMode
        && view.chartView === draft.chartView
        && view.savingsSimulationId === draft.savingsSimulationId;
}
