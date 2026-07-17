import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { redirect } from "next/navigation";
import { sessionOptions, type SessionData } from "./session";

// Server Components/Actions/Route Handlers only — next/headers' cookies() is
// async in Next.js 15. Reading session.isLoggedIn works anywhere this is
// called; session.save()/destroy() (which write cookies) only succeed when
// called from a Server Action or Route Handler.
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

// Server Actions are public HTTP endpoints regardless of which page
// references them — middleware.ts and (protected)/layout.tsx protect page
// *rendering*, but every admin Server Action must still assert this itself
// rather than assuming it can only ever be reached from a protected route.
export async function requireAdminSession(): Promise<IronSession<SessionData>> {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/admin/login");
  }
  return session;
}
