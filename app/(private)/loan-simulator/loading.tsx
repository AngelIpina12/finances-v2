import { Skeleton } from "@/src/shared/components/ui/skeleton";

export default function LoanSimulatorLoading() {
    return (
        <div className="space-y-7">
            <div className="space-y-3">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-12 w-72" />
                <Skeleton className="h-5 w-96 max-w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}
            </div>
            <Skeleton className="h-96 rounded-2xl" />
        </div>
    );
}
