export type MetricTrend = "up" | "down" | "neutral";

export interface DashboardMetric {
  label: string;
  value: number;
  format?: "currency" | "percentage";
  trend: MetricTrend;
  trendLabel: string;
  positive?: boolean;
}

export interface DashboardData {
  periodLabel: string;
  overview: {
    netWorth: DashboardMetric;
    income: DashboardMetric;
    expenses: DashboardMetric;
    cashFlow: DashboardMetric;
  };
  netWorthHistory: Array<{ label: string; value: number }>;
  spendingByCategory: Array<{ name: string; amount: number; percentage: number; color: string }>;
  budgets: Array<{ name: string; spent: number; allocated: number; status: "healthy" | "warning" | "exceeded" }>;
  upcomingPayments: Array<{ name: string; date: string; amount: number; badge?: string }>;
  account: {
    name: string;
    type: "cash" | "debit" | "credit" | "wallet" | "investment" | "fixed_income" | "loan";
    institution: string;
    balance: number;
    lastFourDigits: string;
    availableCredit: number;
    creditLimit: number;
  } | null;
  goals: Array<{ name: string; current: number; target: number }>;
  recentTransactions: Array<{ merchant: string; category: string; account: string; amount: number; date: string }>;
}
