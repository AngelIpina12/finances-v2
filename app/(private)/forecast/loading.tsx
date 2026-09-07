import { Skeleton } from "@/src/shared/components/ui/skeleton";

export default function ForecastLoading() {
    return (
        <div className="space-y-7" role="status" aria-label="Cargando previsión">
            <span className="sr-only">Cargando previsión financiera...</span>

            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-12 w-56" />
                    <Skeleton className="h-5 w-96 max-w-full" />
                </div>
                <div className="flex gap-2">
                    <Skeleton className="h-8 w-18" />
                    <Skeleton className="h-8 w-18" />
                    <Skeleton className="h-8 w-18" />
                </div>
            </header>

            <div className="flex gap-2 overflow-hidden">
                {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton key={index} className="h-8 w-32 shrink-0" />
                ))}
            </div>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <article key={index} className="rounded-2xl border bg-card p-5">
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="mt-2 h-3 w-40" />
                        <Skeleton className="mt-6 h-8 w-32" />
                        <Skeleton className="mt-2 h-3 w-48" />
                    </article>
                ))}
            </section>

            <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="space-y-2 border-b p-5">
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="divide-y">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <article key={index} className="flex items-center gap-3 p-5">
                            <Skeleton className="size-10 shrink-0 rounded-xl" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-44" />
                                <Skeleton className="h-3 w-60" />
                            </div>
                            <Skeleton className="h-5 w-24" />
                        </article>
                    ))}
                </div>
            </section>
        </div>
    );
}
