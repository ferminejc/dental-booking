import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";
import { LoginForm } from "@/components/admin/login-form";

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session.isLoggedIn) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Admin login</h1>
          <p className="text-sm text-muted-foreground">Sign in to manage appointments.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
