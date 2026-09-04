import { Skeleton } from "@/src/shared/components/ui/skeleton";

export default function FinancingLoading() {
    return (
        <div className="space-y-7" role="status" aria-label="Cargando financiamientos">
            <span className="sr-only">Cargando financiamientos...</span>
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-72" />
                    <Skeleton className="h-12 w-80 sm:h-14" />
                    <Skeleton className="h-5 w-96 max-w-full" />
                </div>
                <Skeleton className="h-11 w-48" />
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                    <section key={index} className="space-y-5 rounded-2xl border bg-card p-5">
                        <div className="flex justify-between"><Skeleton className="h-5 w-36" /><Skeleton className="h-5 w-16 rounded-full" /></div>
                        <div className="grid grid-cols-2 gap-4"><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
                        <Skeleton className="h-2 w-full rounded-full" />
                        <Skeleton className="h-18 w-full rounded-xl" />
                        <div className="space-y-3 rounded-xl border p-3">{Array.from({ length: 4 }).map((_, row) => <Skeleton key={row} className="h-4 w-full" />)}</div>
                    </section>
                ))}
            </div>
        </div>
    );
}
