import { redirect } from "next/navigation";
import { requireAuth } from "@/src/lib/auth-server";
import { PrivateNavigation } from "@/src/shared/components/ui/private-navigation";

export default async function PrivateLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { isAuth, session } = await requireAuth();
  
  if (!isAuth) redirect("/auth/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex-1 [--dock-space:4rem] sm:[--dock-space:5rem] sm:dock-autohide:[--dock-space:0px] dock-bottom:pb-(--dock-space) dock-top:pt-(--dock-space) dock-left:pl-(--dock-space) dock-right:pr-(--dock-space)">
        <main className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <PrivateNavigation user={{ name: session?.user.name, email: session?.user.email }} />
    </div>
  );
}
