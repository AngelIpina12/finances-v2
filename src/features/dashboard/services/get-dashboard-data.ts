import type { DashboardData } from "../types/dashboard.types";

/**
 * Temporary UI data. Replace this function with the Drizzle query layer once
 * accounts, transactions, budgets and goals have been added to the schema.
 */
export async function getDashboardData(userId: string): Promise<DashboardData> {
  void userId;
  return {
    overview: {
      netWorth: { label: "Patrimonio neto", value: 284420.5, trend: "up", trendLabel: "4.2% este mes" },
      income: { label: "Ingresos", value: 42500, trend: "up", trendLabel: "8.3% vs. mes anterior" },
      expenses: { label: "Gastos", value: 28450, trend: "down", trendLabel: "5.1% vs. mes anterior", positive: true },
      cashFlow: { label: "Flujo neto", value: 14050, trend: "up", trendLabel: "33.1% tasa de ahorro", positive: true },
    },
    netWorthHistory: [
      { label: "Mar", value: 208000 }, { label: "Abr", value: 224000 }, { label: "May", value: 219000 },
      { label: "Jun", value: 246000 }, { label: "Jul", value: 273000 }, { label: "Ago", value: 284420 },
    ],
    spendingByCategory: [
      { name: "Alimentos", amount: 8430, percentage: 30, color: "bg-blue-500" },
      { name: "Vivienda", amount: 7000, percentage: 25, color: "bg-violet-500" },
      { name: "Transporte", amount: 3500, percentage: 12, color: "bg-amber-500" },
      { name: "Suscripciones", amount: 1300, percentage: 5, color: "bg-rose-500" },
      { name: "Otros", amount: 8220, percentage: 28, color: "bg-slate-400" },
    ],
    budgets: [
      { name: "Entretenimiento", spent: 2350, allocated: 2500, status: "warning" },
      { name: "Supermercado", spent: 4200, allocated: 5000, status: "warning" },
      { name: "Transporte", spent: 1200, allocated: 3000, status: "healthy" },
    ],
    upcomingPayments: [
      { name: "Netflix", date: "Mañana", amount: 299, badge: "Suscripción" },
      { name: "American Express", date: "29 Ago", amount: 8450, badge: "Tarjeta de crédito" },
      { name: "Renta", date: "01 Sep", amount: 12000 },
      { name: "Spotify", date: "04 Sep", amount: 199, badge: "Autopago" },
    ],
    account: { name: "BBVA Platinum", institution: "BBVA", balance: -14850, lastFourDigits: "4329", availableCredit: 35150, creditLimit: 50000 },
    goals: [{ name: "Fondo de emergencia", current: 72000, target: 100000 }, { name: "Viaje a Japón", current: 23400, target: 60000 }],
    recentTransactions: [
      { merchant: "Amazon", category: "Compras", account: "AMEX", amount: -1420, date: "Hoy" },
      { merchant: "Nómina", category: "Ingresos", account: "BBVA", amount: 32000, date: "Ayer" },
      { merchant: "Spotify", category: "Suscripciones", account: "Nu", amount: -199, date: "Ayer" },
      { merchant: "Uber", category: "Transporte", account: "AMEX", amount: -245, date: "24 Ago" },
      { merchant: "Chedraui", category: "Supermercado", account: "BBVA", amount: -1260, date: "23 Ago" },
    ],
  };
}
