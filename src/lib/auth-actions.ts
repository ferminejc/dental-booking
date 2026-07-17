"use server";

import { redirect } from "next/navigation";
import { formDataToObject } from "./form-data";
import { getSession } from "./get-session";
import { verifyPassword } from "./password";
import { loginSchema } from "./validation";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH) {
  throw new Error("ADMIN_USERNAME and ADMIN_PASSWORD_HASH must both be set");
}

export type LoginState =
  | { status: "idle" }
  | { status: "invalid"; fieldErrors: Record<string, string[]> }
  | { status: "error"; message: string };

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const raw = formDataToObject(formData, ["username", "password"]);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
    return { status: "invalid", fieldErrors };
  }

  const { username, password } = parsed.data;
  // verifyPassword always runs, even when the username is already known-wrong,
  // so a wrong-username attempt takes the same time as a wrong-password one —
  // same anti-enumeration spirit as cancelAppointmentByRefAndMobile.
  const usernameOk = username === ADMIN_USERNAME;
  const passwordOk = verifyPassword(password, ADMIN_PASSWORD_HASH!);

  if (!usernameOk || !passwordOk) {
    return { status: "invalid", fieldErrors: { password: ["Invalid username or password"] } };
  }

  try {
    const session = await getSession();
    session.isLoggedIn = true;
    session.username = username;
    await session.save();
  } catch {
    return { status: "error", message: "Something went wrong logging you in. Please try again." };
  }

  redirect("/admin"); // outside the try/catch — must not be swallowed by it
}

export async function logout(): Promise<void> {
  const session = await getSession();
  session.destroy();
  redirect("/admin/login");
}
