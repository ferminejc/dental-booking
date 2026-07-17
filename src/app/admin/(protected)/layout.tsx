import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { AdminNav } from "@/components/admin/admin-nav";
import { logout } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense-in-depth: middleware.ts is the primary gate (it also protects
  // any future Route Handlers, which a layout alone never would), this is a
  // cheap second check plus where session.username gets read for display.
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-6">
        <AdminNav />
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Signed in as {session.username}</span>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Log out
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
    </div>
  );
}
