import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthContext } from "../domain/auth";

/**
 * Session handling (ADR-004).
 *
 * Production sign-in and the second factor come from an external identity provider that has not been
 * chosen yet (needs founder approval as a vendor). Until then the app runs ONLY in AUTH_MODE=dev:
 * a development sign-in with a SIMULATED second-factor step, clearly labelled in the UI.
 * With any other AUTH_MODE, sign-in is unavailable — the app never silently falls back to dev mode.
 */
const COOKIE = "eom_session";
const MAX_AGE_S = 60 * 60 * 8;

export function authMode(): "dev" | "unconfigured" {
  return process.env.AUTH_MODE === "dev" ? "dev" : "unconfigured";
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (at least 32 characters)");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

interface SessionPayload extends AuthContext {
  exp: number;
}

export async function writeSession(ctx: AuthContext): Promise<void> {
  const payload = Buffer.from(JSON.stringify({ ...ctx, exp: Date.now() + MAX_AGE_S * 1000 })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function readSession(): Promise<AuthContext | null> {
  const jar = await cookies(); // read first so every caller is rendered per request
  if (authMode() !== "dev") return null;
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    if (typeof p.exp !== "number" || p.exp < Date.now()) return null;
    if (p.aal !== "aal1" && p.aal !== "aal2") return null;
    return { accountId: p.accountId, aal: p.aal };
  } catch {
    return null;
  }
}

export async function requireSession(next = "/home"): Promise<AuthContext> {
  const s = await readSession();
  if (!s) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return s;
}
