import { Skeleton } from "@/src/shared/components/ui/skeleton";

export default function TransactionsLoading() {
    return (
        <div className="space-y-7" role="status" aria-label="Cargando movimientos">
            <span className="sr-only">Cargando movimientos...</span>

            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-44" />
                    <Skeleton className="h-9 w-52" />
                    <Skeleton className="h-5 w-96 max-w-full" />
                </div>
                <Skeleton className="h-11 w-48" />
            </header>

            <div className="flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
            </div>

            <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="divide-y">
                    {Array.from({ length: 8 }).map((_, index) => (
                        <article key={index} className="flex items-center gap-3 p-4 sm:p-5">
                            <Skeleton className="size-10 shrink-0 rounded-xl" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className={`h-5 ${index % 3 === 0 ? "w-44" : "w-32"}`} />
                                <Skeleton className="h-3 w-80 max-w-[75%]" />
                            </div>
                            <Skeleton className="h-5 w-24" />
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}
