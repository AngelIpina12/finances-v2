import { Skeleton } from "@/src/shared/components/ui/skeleton";

export default function FixedIncomeLoading() {
    return (
        <div className="space-y-7">
            <div className="space-y-3">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-12 w-64" />
                <Skeleton className="h-5 w-96 max-w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
                {Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-72 rounded-2xl" />)}
            </div>
        </div>
    );
}
