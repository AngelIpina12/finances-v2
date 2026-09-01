import { Skeleton } from "@/src/shared/components/ui/skeleton";

function AccountCardSkeleton() {
    return (
        <article className="rounded-2xl border bg-card p-3 shadow-sm">
            <Skeleton className="aspect-[1.586/1] w-full rounded-2xl" />
            <div className="flex items-start justify-between gap-3 px-2 pb-1 pt-4">
                <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex gap-1">
                    <Skeleton className="size-8 rounded-lg" />
                    <Skeleton className="size-8 rounded-lg" />
                </div>
            </div>
        </article>
    );
}

export default function AccountsLoading() {
    return (
        <div className="space-y-7" role="status" aria-label="Cargando cuentas">
            <span className="sr-only">Cargando cuentas...</span>

            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-52" />
                    <Skeleton className="h-12 w-56 sm:h-14" />
                    <Skeleton className="h-5 w-80 max-w-full" />
                </div>
                <Skeleton className="h-11 w-44" />
            </header>

            <div className="flex flex-wrap items-center gap-2">
                {["w-16", "w-20", "w-20", "w-20", "w-20"].map((width, index) => (
                    <Skeleton key={index} className={`h-8 ${width}`} />
                ))}
                <Skeleton className="ml-auto h-5 w-28" />
            </div>

            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                    <AccountCardSkeleton key={index} />
                ))}
            </section>
        </div>
    );
}
