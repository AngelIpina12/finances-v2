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
            </header>

            <section className="space-y-4 rounded-2xl border bg-card p-5">
                <div className="flex gap-2">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-8 w-18" />
                    ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="space-y-2">
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-12 w-full rounded-xl" />
                        </div>
                    ))}
                </div>
            </section>

            <div className="flex gap-2 overflow-hidden">
                {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-8 w-32 shrink-0" />
                ))}
            </div>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <article className="rounded-2xl border bg-card p-5 md:col-span-2 xl:col-span-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-4 h-9 w-36" />
                    <Skeleton className="mt-5 h-3 w-44" />
                    <Skeleton className="mt-2 h-3 w-36" />
                </article>
                {Array.from({ length: 4 }).map((_, index) => (
                    <article key={index} className="rounded-2xl border bg-card p-5">
                        <Skeleton className="size-9 rounded-xl" />
                        <Skeleton className="mt-4 h-3 w-32" />
                        <Skeleton className="mt-3 h-7 w-28" />
                    </article>
                ))}
            </section>

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
                    <Skeleton className="h-7 w-48" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="hidden grid-cols-[minmax(0,1fr)_repeat(3,8rem)] gap-6 border-b px-5 py-3 sm:grid">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="ml-auto h-3 w-14" />
                    <Skeleton className="ml-auto h-3 w-14" />
                    <Skeleton className="ml-auto h-3 w-16" />
                </div>
                <div className="divide-y">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <article key={index} className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_repeat(3,8rem)]">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="ml-auto h-4 w-20" />
                            <Skeleton className="ml-auto h-4 w-20" />
                            <Skeleton className="ml-auto h-4 w-20" />
                        </article>
                    ))}
                </div>
            </section>

            <section className="overflow-hidden rounded-2xl border bg-card">
                <div className="space-y-2 border-b p-5">
                    <Skeleton className="h-7 w-40" />
                    <Skeleton className="h-4 w-72" />
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
