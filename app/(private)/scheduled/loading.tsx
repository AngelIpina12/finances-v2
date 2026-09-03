import { Skeleton } from "@/src/shared/components/ui/skeleton";

export default function ScheduledLoading() {
    return (
        <div className="space-y-7" role="status" aria-label="Cargando programados">
            <span className="sr-only">Cargando movimientos programados...</span>

            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-52" />
                    <Skeleton className="h-11 w-64" />
                    <Skeleton className="h-5 w-lg max-w-full" />
                </div>
                <Skeleton className="h-11 w-52" />
            </header>

            <section className="grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-4 rounded-2xl border bg-card p-4"
                    >
                        <Skeleton className="size-11 rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-7 w-10" />
                            <Skeleton className="h-3 w-28" />
                        </div>
                    </div>
                ))}
            </section>

            <div className="flex gap-2 overflow-hidden">
                {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-8 w-24 shrink-0" />
                ))}
            </div>

            <section className="space-y-3">
                <Skeleton className="h-4 w-44" />
                <div className="overflow-hidden rounded-2xl border bg-card">
                    <div className="divide-y">
                        {Array.from({ length: 5 }).map((_, index) => (
                            <article
                                key={index}
                                className="flex items-center gap-3 p-4 sm:p-5"
                            >
                                <Skeleton className="size-11 shrink-0 rounded-xl" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <Skeleton className="h-5 w-44" />
                                    <Skeleton className="h-3 w-72 max-w-[75%]" />
                                </div>
                                <Skeleton className="h-5 w-24" />
                                <Skeleton className="size-8 rounded-lg" />
                            </article>
                        ))}
                    </div>
                </div>
            </section>
        </div>
    );
}
