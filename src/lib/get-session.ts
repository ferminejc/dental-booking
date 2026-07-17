import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { sessionOptions, type SessionData } from "./session";

// Server Components/Actions/Route Handlers only — next/headers' cookies() is
// async in Next.js 15. Reading session.isLoggedIn works anywhere this is
// called; session.save()/destroy() (which write cookies) only succeed when
// called from a Server Action or Route Handler.
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}
