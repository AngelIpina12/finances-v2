import { redirect } from "next/navigation";
import { UserMenu } from "@/src/features/auth/components/UserMenu";
import { requireAuth } from "@/src/lib/auth-server";

export default async function PrivateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { isAuth, session } = await requireAuth();
  if (!isAuth) redirect("/auth/login");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-end border-b bg-background/95 px-4 backdrop-blur lg:px-8">
        <UserMenu name={session?.user.name} email={session?.user.email} />
      </header>
      <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
