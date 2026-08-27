import { AccountsSummary, BudgetOverview, GoalsSummary, RecentTransactions, SpendingByCategory, UpcomingPayments } from "./dashboard-widgets";
import { DashboardHeader } from "./dashboard-header";
import { DashboardKpis } from "./dashboard-kpis";
import { NetWorthChart } from "./net-worth-chart";
import type { DashboardData } from "../types/dashboard.types";

export function Dashboard({ data, userName }: { data: DashboardData; userName?: string }) {
  return (
    <div className="space-y-6">
      <DashboardHeader userName={userName} />
      <DashboardKpis overview={data.overview} />
      <section className="grid gap-4 xl:grid-cols-12">
        <NetWorthChart history={data.netWorthHistory} />
        <SpendingByCategory items={data.spendingByCategory} />
        <BudgetOverview budgets={data.budgets} />
        <UpcomingPayments items={data.upcomingPayments} />
        <AccountsSummary account={data.account} />
        <GoalsSummary goals={data.goals} />
        <RecentTransactions items={data.recentTransactions} />
      </section>
    </div>
  );
}
