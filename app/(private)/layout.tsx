import { redirect } from "next/navigation";
import { UserMenu } from "@/src/features/auth/components/UserMenu";
import { requireAuth } from "@/src/lib/auth-server";
import { PrivateNavigation } from "@/src/shared/components/ui/private-navigation";
import { ThemeToggle } from "@/src/shared/components/ui/theme-toggle";

export default async function PrivateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { isAuth, session } = await requireAuth();
  if (!isAuth) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur lg:px-8">
        <PrivateNavigation />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserMenu name={session?.user.name} email={session?.user.email} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
