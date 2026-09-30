import Link from "next/link";
import { redirect } from "next/navigation";
import { UserMenu } from "@/src/features/auth/components/UserMenu";
import { requireAuth } from "@/src/lib/auth-server";
import { PrivateNavigation } from "@/src/shared/components/ui/private-navigation";
import { ThemeToggle } from "@/src/shared/components/ui/theme-toggle";
import { PaletteSwitcher } from "@/src/shared/components/ui/palette-switcher";
import { DockPositionSwitcher } from "@/src/shared/components/ui/dock-position-switcher";

export default async function PrivateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { isAuth, session } = await requireAuth();
  if (!isAuth) redirect("/auth/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Con el dock arriba, la barra se va hasta abajo */}
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur lg:px-8 dock-top:order-last dock-top:top-auto dock-top:bottom-0 dock-top:border-t dock-top:border-b-0">
        <Link href="/dashboard" className="shrink-0 font-serif text-lg font-bold tracking-tight">
          FINANCES
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <PaletteSwitcher />
          <DockPositionSwitcher />
          <UserMenu name={session?.user.name} email={session?.user.email} />
        </div>
      </header>
      {/* Reserva el espacio que ocupa el dock en el lado donde esté */}
      <div className="flex-1 [--dock-space:4rem] sm:[--dock-space:5rem] sm:dock-autohide:[--dock-space:0px] dock-bottom:pb-(--dock-space) dock-top:pt-(--dock-space) dock-left:pl-(--dock-space) dock-right:pr-(--dock-space)">
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <PrivateNavigation />
    </div>
  );
}
