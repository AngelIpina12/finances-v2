import Link from "next/link";
import { ArrowRight, CreditCard } from "lucide-react";
import {
    Card, CardContent, CardHeader,
    CardTitle
} from "@/components/ui/card";
import {
    Table, TableBody, TableCaption,
    TableCell, TableFooter, TableHead,
    TableHeader, TableRow,
} from "@/components/ui/table"
import type { DashboardData } from "../types/dashboard.types";

const money = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const percent = (value: number, total: number) => Math.min(100, Math.round((value / total) * 100));

function Progress({ value, color = "bg-primary" }: { value: number; color?: string }) {
    return (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
                className={`h-full rounded-full ${color}`}
                style={{ width: `${Math.min(value, 100)}%` }}
            />
        </div>
    )
}

function Heading({ children, href }: { children: React.ReactNode; href?: "/accounts" }) {
    return (
        <CardHeader className="pb-4">
            <CardTitle>{children}</CardTitle>
            {href && (
                <Link
                    href={href}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                    Ver todo
                    <ArrowRight className="size-3.5" />
                </Link>
            )
            }
        </CardHeader>
    )
}

export function SpendingByCategory({ items }: { items: DashboardData["spendingByCategory"] }) {
    return (
        <Card className="xl:col-span-4">
            <Heading>Gasto por categoría</Heading>
            <CardContent className="space-y-5">
                {items.map((item) =>
                    <div
                        key={item.name}
                        className="space-y-2"
                    >
                        <div className="flex justify-between text-sm">
                            <span>{item.name}</span>
                            <span className="font-medium">
                                {money.format(item.amount)}
                            </span>
                        </div>
                        <Progress
                            value={item.percentage}
                            color={item.color}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export function BudgetOverview({ budgets }: { budgets: DashboardData["budgets"] }) {
    const total = budgets.reduce((n, b) => n + b.allocated, 0);
    const spent = budgets.reduce((n, b) => n + b.spent, 0);

    return (
        <Card className="xl:col-span-7">
            <Heading>Estado de presupuestos</Heading>
            <CardContent className="space-y-5">
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span>{money.format(spent)} de {money.format(total)}</span>
                        <span>{percent(spent, total)}%</span>
                    </div>
                    <Progress value={percent(spent, total)} />
                </div>
                {budgets.map((budget) => {
                    const used = percent(budget.spent, budget.allocated);
                    return (
                        <div key={budget.name} className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>{budget.name}</span>
                                <span className="text-muted-foreground">
                                    {money.format(budget.spent)} / {money.format(budget.allocated)}
                                </span>
                            </div>
                            <Progress
                                value={used}
                                color={
                                    budget.status === "warning"
                                        ? "bg-amber-500"
                                        : budget.status === "exceeded"
                                            ? "bg-destructive"
                                            : "bg-emerald-500"
                                }
                            />
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}

export function UpcomingPayments({ items }: { items: DashboardData["upcomingPayments"] }) {
    return (
        <Card className="xl:col-span-5">
            <Heading>Próximos pagos</Heading>
            <CardContent className="space-y-4">
                {items.map((item) =>
                    <div
                        key={item.name}
                        className="flex justify-between gap-3"
                    >
                        <div>
                            <p className="text-sm font-medium">
                                {item.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {item.date}{item.badge ? ` · ${item.badge}` : ""}
                            </p>
                        </div>
                        <p className="text-sm font-medium">
                            {money.format(item.amount)}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export function AccountsSummary({ account }: { account: DashboardData["account"] }) {
    return (
        <Card className="xl:col-span-7">
            <Heading href="/accounts">Mis cuentas</Heading>
            <CardContent>
                <div className="grid gap-6 md:grid-cols-[minmax(220px,0.9fr)_1.1fr]">
                    <div className="aspect-[1.586/1] rounded-xl bg-linear-to-br from-slate-950 to-slate-700 p-5 text-white shadow-lg">
                        <div className="flex justify-between text-xs tracking-widest">
                            <span>{account.institution.toUpperCase()}</span>
                            <CreditCard className="size-6" />
                        </div>
                        <p className="mt-12 text-lg tracking-[0.22em]">
                            •••• •••• •••• {account.lastFourDigits}
                        </p>
                        <div className="mt-5 flex justify-between text-sm">
                            <span>{account.name}</span>
                            <span>VISA</span>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-sm text-muted-foreground">
                                Deuda actual
                            </p>
                            <p className="text-2xl font-semibold">
                                {money.format(Math.abs(account.balance))}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">
                                    Crédito disponible
                                </p>
                                <p className="font-medium">
                                    {money.format(account.availableCredit)}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">
                                    Límite de crédito
                                </p>
                                <p className="font-medium">
                                    {money.format(account.creditLimit)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export function GoalsSummary({ goals }: { goals: DashboardData["goals"] }) {
    return (
        <Card className="xl:col-span-5">
            <Heading>Metas</Heading>
            <CardContent className="space-y-5">
                {goals.map((goal) => {
                    const complete = percent(goal.current, goal.target);
                    return (
                        <div key={goal.name} className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium">{goal.name}</span>
                                <span className="text-muted-foreground">{complete}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {money.format(goal.current)} de {money.format(goal.target)}
                            </p>
                            <Progress value={complete} color="bg-violet-500" />
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
export function RecentTransactions({ items }: { items: DashboardData["recentTransactions"] }) {
    return (
        <Card className="xl:col-span-12">
            <Heading>Movimientos recientes</Heading>
            <CardContent className="overflow-x-auto">
                <Table className="w-full min-w-150 text-left text-sm">
                    <TableHeader className="border-b text-xs text-muted-foreground">
                        <TableRow className="border-b last:border-0">
                            <TableHead className="pb-3">Comercio</TableHead>
                            <TableHead className="pb-3">Categoría</TableHead>
                            <TableHead className="pb-3">Cuenta</TableHead>
                            <TableHead className="pb-3">Fecha</TableHead>
                            <TableHead className="pb-3 text-right">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) =>
                            <TableRow key={`${item.merchant}-${item.date}`} className="border-b last:border-0">
                                <TableCell className="py-3 font-medium">{item.merchant}</TableCell>
                                <TableCell className="py-3 text-muted-foreground">{item.category}</TableCell>
                                <TableCell className="py-3 text-muted-foreground">{item.account}</TableCell>
                                <TableCell className="py-3 text-muted-foreground">{item.date}</TableCell>
                                <TableCell className={`py-3 text-right font-medium ${item.amount > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : ""}`}
                                >
                                    {item.amount > 0 ? "+" : "-"}{money.format(Math.abs(item.amount))}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
