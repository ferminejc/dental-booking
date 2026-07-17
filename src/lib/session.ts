import type { SessionOptions } from "iron-session";

export interface SessionData {
  isLoggedIn: boolean;
  username?: string;
}

// No `next/headers` import here (deliberately) — middleware runs on the Edge
// Runtime and can't use it. getSession() (which does need next/headers) lives
// in ./get-session.ts so middleware can import just this file's exports.
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET is not set or is shorter than 32 characters");
}

// Distinct from ADMIN_PASSWORD_HASH: this is iron-session's cookie-sealing
// key, not the admin's password hash. Generate with e.g. `openssl rand -base64 32`.
export const sessionOptions: SessionOptions = {
  cookieName: "admin_session",
  password: sessionSecret,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
