import {
    AccountsSummary, BudgetOverview, GoalsSummary,
    RecentTransactions, SpendingByCategory, UpcomingPayments
} from "./dashboard-widgets";
import { DashboardHeader } from "./dashboard-header";
import { DashboardKpis } from "./dashboard-kpis";
import { NetWorthChart } from "./net-worth-chart";
import type { DashboardData } from "../types/dashboard.types";

export function Dashboard({ data, userName }: { data: DashboardData; userName?: string }) {
    return (
        <div className="space-y-6">
            <DashboardHeader userName={userName} periodLabel={data.periodLabel} />
            <DashboardKpis overview={data.overview} />
            <section className="grid gap-4 xl:grid-cols-12">
                <NetWorthChart history={data.netWorthHistory} />
                <SpendingByCategory items={data.spendingByCategory} />
                {data.budgets.length > 0 && <BudgetOverview budgets={data.budgets} />}
                {data.upcomingPayments.length > 0 && <UpcomingPayments items={data.upcomingPayments} />}
                <AccountsSummary account={data.account} />
                {data.goals.length > 0 && <GoalsSummary goals={data.goals} />}
                <RecentTransactions items={data.recentTransactions} />
            </section>
        </div>
    );
}
