import { Skeleton } from "@/src/shared/components/ui/skeleton";

export default function BudgetsLoading() {
    return (
        <div className="space-y-7" role="status" aria-label="Cargando presupuestos">
            <span className="sr-only">Cargando presupuestos...</span>
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-64" />
                    <Skeleton className="h-12 w-72 sm:h-14" />
                    <Skeleton className="h-5 w-96 max-w-full" />
                </div>
                <Skeleton className="h-11 w-48" />
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                    <section key={index} className="space-y-5 rounded-2xl border bg-card p-5">
                        <Skeleton className="h-5 w-40" />
                        <div className="flex justify-between">
                            <Skeleton className="h-8 w-28" />
                            <Skeleton className="h-5 w-24" />
                        </div>
                        <Skeleton className="h-2 w-full" />
                        <Skeleton className="h-5 w-full" />
                    </section>
                ))}
            </div>
        </div>
    );
}
