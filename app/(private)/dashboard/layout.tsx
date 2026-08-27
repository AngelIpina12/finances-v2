import { redirect } from "next/navigation";
import { UserMenu } from "@/src/features/auth/components/UserMenu";
import { requireAuth } from "@/src/lib/auth-server";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
    const { isAuth, session } = await requireAuth();

    if (!isAuth) {
        redirect("/auth/login");
    }

    return (
        <div className="min-h-screen bg-background">
            <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card lg:block">
                {/* Logo + navegación: Overview, Accounts, Transactions, Budgets, Goals */}
            </aside>

            <div className="lg:pl-64">
                <header className="sticky top-0 z-10 flex h-16 items-center justify-end border-b bg-background/95 px-4 backdrop-blur lg:px-8">
                    {/* Menú móvil, breadcrumbs, selector de cuenta/perfil */}
                    <UserMenu name={session?.user.name} email={session?.user.email} />
                </header>

                <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
