import { Skeleton } from "@/src/shared/components/ui/skeleton";

interface Props {
	className?: string;
	children: React.ReactNode;
}

function DashboardCard({ className, children }: Props) {
	return (
		<section className={`rounded-xl border bg-card p-5 ${className ?? ""}`}>
			{children}
		</section>
	);
}

export default function DashboardLoading() {
	return (
		<div className="space-y-6" role="status" aria-label="Cargando dashboard">
			<span className="sr-only">Cargando dashboard...</span>

			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div className="space-y-2">
					<Skeleton className="h-8 w-40" />
					<Skeleton className="h-5 w-72 max-w-full" />
				</div>
				<div className="flex gap-3">
					<Skeleton className="h-10 w-32" />
					<Skeleton className="h-10 w-40" />
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
				{Array.from({ length: 4 }).map((_, index) => (
					<DashboardCard key={index} className="space-y-4 xl:col-span-3">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-8 w-36" />
						<Skeleton className="h-4 w-28" />
					</DashboardCard>
				))}

				<DashboardCard className="space-y-5 xl:col-span-8">
					<div className="flex items-center justify-between">
						<Skeleton className="h-5 w-40" />
						<Skeleton className="h-8 w-28" />
					</div>
					<Skeleton className="h-64 w-full" />
				</DashboardCard>

				<DashboardCard className="space-y-5 xl:col-span-4">
					<Skeleton className="h-5 w-44" />
					<div className="space-y-5">
						{Array.from({ length: 5 }).map((_, index) => (
							<div key={index} className="space-y-2">
								<div className="flex justify-between gap-4">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-4 w-16" />
								</div>
								<Skeleton className="h-2 w-full" />
							</div>
						))}
					</div>
				</DashboardCard>

				<DashboardCard className="space-y-5 xl:col-span-7">
					<Skeleton className="h-5 w-36" />
					<Skeleton className="h-5 w-52" />
					<Skeleton className="h-3 w-full" />
					<div className="space-y-4">
						{Array.from({ length: 3 }).map((_, index) => (
							<div key={index} className="space-y-2">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-full" />
							</div>
						))}
					</div>
				</DashboardCard>

				<DashboardCard className="space-y-4 xl:col-span-5">
					<Skeleton className="h-5 w-40" />
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="flex items-center justify-between gap-4">
							<div className="space-y-2">
								<Skeleton className="h-4 w-28" />
								<Skeleton className="h-3 w-20" />
							</div>
							<Skeleton className="h-4 w-16" />
						</div>
					))}
				</DashboardCard>

				<DashboardCard className="space-y-5 xl:col-span-7">
					<Skeleton className="h-5 w-28" />
					<div className="grid gap-6 md:grid-cols-[minmax(220px,0.9fr)_1.1fr]">
						<Skeleton className="h-44 w-full rounded-xl" />
						<div className="space-y-4">
							{Array.from({ length: 4 }).map((_, index) => (
								<div key={index} className="flex justify-between gap-4">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-4 w-20" />
								</div>
							))}
						</div>
					</div>
				</DashboardCard>

				<DashboardCard className="space-y-5 xl:col-span-5">
					<Skeleton className="h-5 w-24" />
					{Array.from({ length: 2 }).map((_, index) => (
						<div key={index} className="space-y-2">
							<Skeleton className="h-4 w-36" />
							<Skeleton className="h-3 w-full" />
						</div>
					))}
				</DashboardCard>

				<DashboardCard className="space-y-5 xl:col-span-12">
					<Skeleton className="h-5 w-44" />
					<div className="space-y-4">
						{Array.from({ length: 6 }).map((_, index) => (
							<div key={index} className="grid grid-cols-[1.4fr_1fr_1fr_auto] gap-4">
								<Skeleton className="h-5" />
								<Skeleton className="h-5" />
								<Skeleton className="h-5" />
								<Skeleton className="h-5 w-20" />
							</div>
						))}
					</div>
				</DashboardCard>
			</div>
		</div>
	);
}
