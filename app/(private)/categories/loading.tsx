import { Skeleton } from "@/src/shared/components/ui/skeleton";

function CategoryGroupSkeleton() {
    return (
        <section className="overflow-hidden rounded-2xl border bg-card">
            <header className="flex items-center justify-between border-b px-5 py-4">
                <div className="flex items-center gap-2">
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-3 w-20" />
            </header>

            <div className="divide-y">
                {Array.from({ length: 6 }).map((_, index) => (
                    <article
                        key={index}
                        className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-5 py-4"
                    >
                        <Skeleton className="size-10 rounded-xl" />
                        <div className="min-w-0 space-y-2">
                            <div className="flex items-center gap-2">
                                <Skeleton className={`h-5 ${index % 2 ? "w-24" : "w-32"}`} />
                                {index < 3 && <Skeleton className="h-4 w-20 rounded-full" />}
                            </div>
                            <Skeleton className="h-3 w-24" />
                        </div>
                        <Skeleton className="size-8 rounded-lg" />
                    </article>
                ))}
            </div>
        </section>
    );
}

export default function CategoriesLoading() {
    return (
        <div className="space-y-7" role="status" aria-label="Cargando categorías">
            <span className="sr-only">Cargando categorías...</span>

            <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-4 w-52" />
                    <Skeleton className="h-12 w-48 sm:h-14" />
                    <Skeleton className="h-5 w-96 max-w-full" />
                </div>
                <Skeleton className="h-11 w-44" />
            </header>

            <div className="grid gap-5 lg:grid-cols-2">
                <CategoryGroupSkeleton />
                <CategoryGroupSkeleton />
            </div>
        </div>
    );
}
