import { Skeleton } from "@/src/shared/components/ui/skeleton";

function PanelHeader({ titleWidth, descriptionWidth, action }: {
    titleWidth: string;
    descriptionWidth: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
                <Skeleton className={`h-6 ${titleWidth}`} />
                <Skeleton className={`h-4 max-w-full ${descriptionWidth}`} />
            </div>
            {action}
        </div>
    );
}

export default function ForecastLoading() {
    return (
        <div className="space-y-7" role="status" aria-label="Cargando previsión">
            <span className="sr-only">Cargando previsión financiera...</span>

            <header className="space-y-2">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-12 w-56" />
                <Skeleton className="h-5 w-96 max-w-full" />
            </header>

            <div className="flex items-center gap-1.5 rounded-2xl border bg-card p-1.5">
                <Skeleton className="h-8 w-36 rounded-lg" />
                <span className="mx-1 hidden h-5 w-px bg-border md:block" />
                <div className="hidden items-center gap-1.5 md:flex">
                    <Skeleton className="h-8 w-32 rounded-lg" />
                    <Skeleton className="h-8 w-32 rounded-lg" />
                    <Skeleton className="h-8 w-28 rounded-lg" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                    <Skeleton className="h-8 w-20 rounded-lg" />
                </div>
                <Skeleton className="h-8 w-24 rounded-lg md:hidden" />
                <Skeleton className="ml-auto h-8 w-24 rounded-lg" />
            </div>

            <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_24rem] xl:items-start">
                <div className="contents xl:block xl:min-w-0 xl:space-y-6">
                    <section className="order-2 overflow-hidden rounded-2xl border bg-card">
                        <PanelHeader
                            titleWidth="w-44"
                            descriptionWidth="w-80"
                            action={<Skeleton className="h-10 w-full rounded-xl sm:w-64" />}
                        />
                        <div className="p-5">
                            <Skeleton className="h-72 w-full rounded-xl" />
                        </div>
                    </section>

                    <div className="order-4 space-y-6">
                        <section className="overflow-hidden rounded-2xl border bg-card">
                            <PanelHeader titleWidth="w-40" descriptionWidth="w-96" />
                        </section>

                        <section className="overflow-hidden rounded-2xl border bg-card">
                            <PanelHeader titleWidth="w-36" descriptionWidth="w-72" />
                            {Array.from({ length: 3 }).map((_, period) => (
                                <div key={period}>
                                    <div className="space-y-2 border-b bg-muted/40 px-4 py-3 sm:px-5">
                                        <div className="flex items-center gap-2">
                                            <Skeleton className="size-4" />
                                            <Skeleton className="h-4 w-40" />
                                            <Skeleton className="ml-auto h-3 w-20" />
                                        </div>
                                        <div className="grid gap-1.5 pl-6 sm:grid-cols-2 xl:grid-cols-3">
                                            {Array.from({ length: 3 }).map((_, index) => (
                                                <Skeleton key={index} className="h-11 rounded-lg" />
                                            ))}
                                        </div>
                                    </div>
                                    {period === 0 && (
                                        <div className="divide-y border-b">
                                            {Array.from({ length: 3 }).map((_, index) => (
                                                <article key={index} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                                                    <Skeleton className="size-9 shrink-0 rounded-xl" />
                                                    <div className="flex-1 space-y-2">
                                                        <Skeleton className="h-4 w-44" />
                                                        <Skeleton className="h-3 w-60 max-w-full" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Skeleton className="ml-auto h-4 w-24" />
                                                        <Skeleton className="ml-auto h-3 w-32" />
                                                    </div>
                                                </article>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </section>
                    </div>
                </div>

                <aside className="contents xl:block xl:space-y-6">
                    <section className="order-1 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <article key={index} className="rounded-2xl border bg-card p-4">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="mt-2.5 h-7 w-28" />
                                <Skeleton className="mt-3 h-3 w-32 max-w-full" />
                            </article>
                        ))}
                    </section>

                    <section className="order-3 space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-3 w-24" />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <article key={index} className="rounded-2xl border bg-card p-4">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="mt-2 h-3 w-36" />
                                    <Skeleton className="mt-4 h-7 w-32" />
                                    <Skeleton className="mt-2 h-3 w-40" />
                                </article>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>
        </div>
    );
}
