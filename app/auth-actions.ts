"use server";

import { redirect } from "next/navigation";
import { DomainError } from "../src/domain/errors";
import { provisionAccount } from "../src/domain/onboarding";
import { authMode, readProviderSession, readSession, verifyProviderToken, writeProviderSession } from "../src/server/session";
import { AuthProviderError, goTrue, MIN_PASSWORD, type ProviderSession } from "../src/server/supabase-auth";

/** Server actions for Supabase sign-in (ADR-015). The browser never sees the provider's tokens. */

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeNext(v: string, fallback = "/home"): string {
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}

function messageFor(err: unknown): string {
  if (err instanceof AuthProviderError || err instanceof DomainError) return err.message;
  console.error(err);
  return "Sign-in did not work. Please try again.";
}

function fail(path: string, err: unknown, next?: string): never {
  const q = new URLSearchParams({ error: messageFor(err) });
  if (next) q.set("next", next);
  redirect(`${path}?${q.toString()}`);
}

function requireSupabase() {
  if (authMode() !== "supabase") redirect("/sign-in");
}

/** Verifies the provider's tokens, links them to an Echo of Me account (created on first sign-in), and stores the session. */
async function completeSignIn(tokens: ProviderSession, fallbackName: string): Promise<void> {
  const claims = await verifyProviderToken(tokens.accessToken);
  if (!claims.email) throw new AuthProviderError("no_email", "Your account has no confirmed email address.", 400);
  const user = await goTrue().getUser(tokens.accessToken);
  // Invitations are matched by email address, so the address must be proven (ADR-015). The Supabase
  // project must also keep "Confirm email" switched on; this check is the app's own backstop.
  if (!user.emailConfirmed || user.email !== claims.email) {
    throw new AuthProviderError("email_not_confirmed", "Please confirm your email address first, using the link we sent you, then sign in.", 400);
  }
  const displayName = (user.displayName ?? fallbackName ?? "").trim() || claims.email.split("@")[0];
  const { accountId } = await provisionAccount({ authSubject: `supabase|${claims.sub}`, email: claims.email, displayName: displayName.slice(0, 120) });
  await writeProviderSession(tokens, { accountId, sub: claims.sub, aal: claims.aal });
}

export async function supabaseSignUp(fd: FormData) {
  requireSupabase();
  const next = safeNext(str(fd, "next"));
  const email = str(fd, "email").trim().toLowerCase();
  const password = str(fd, "password");
  const displayName = str(fd, "displayName").trim();
  if (!displayName || displayName.length > 120) fail("/sign-up", new DomainError("validation", "Please enter your name."), next);
  if (password.length < MIN_PASSWORD) fail("/sign-up", new DomainError("validation", `Please choose a password of at least ${MIN_PASSWORD} characters.`), next);
  if (password !== str(fd, "password2")) fail("/sign-up", new DomainError("validation", "The two passwords are different."), next);
  let session: ProviderSession | null = null;
  try {
    ({ session } = await goTrue().signUp(email, password, displayName));
    if (session) await completeSignIn(session, displayName);
  } catch (err) {
    fail("/sign-up", err, next);
  }
  if (!session) {
    redirect(`/sign-in?${new URLSearchParams({ ok: "Check your email and confirm your address, then sign in.", next }).toString()}`);
  }
  redirect(next);
}

export async function supabaseSignIn(fd: FormData) {
  requireSupabase();
  const next = safeNext(str(fd, "next"));
  try {
    const tokens = await goTrue().signInWithPassword(str(fd, "email").trim().toLowerCase(), str(fd, "password"));
    await completeSignIn(tokens, "");
  } catch (err) {
    fail("/sign-in", err, next);
  }
  redirect(next);
}

export interface EnrollState {
  factorId?: string;
  qrCode?: string;
  secret?: string;
  error?: string;
}

/** Starts authenticator-app setup: removes any half-finished setups, then creates a new TOTP factor. */
export async function startTotpEnrollment(_prev: EnrollState, _fd: FormData): Promise<EnrollState> {
  requireSupabase();
  const s = await readSession();
  const tokens = await readProviderSession();
  if (!s || !tokens) return { error: "Please sign in again." };
  try {
    const user = await goTrue().getUser(tokens.accessToken);
    if (user.verifiedTotpFactorId) return { error: "An authenticator app is already set up. Enter its code instead." };
    for (const id of user.unverifiedTotpFactorIds) await goTrue().removeFactor(tokens.accessToken, id).catch(() => undefined);
    const f = await goTrue().enrollTotp(tokens.accessToken);
    return { factorId: f.factorId, qrCode: f.qrCode, secret: f.secret };
  } catch (err) {
    return { error: messageFor(err) };
  }
}

/** Checks a 6-digit code (setting up or signing in) and upgrades the session to the second factor (aal2). */
export async function verifyTotpCode(fd: FormData) {
  requireSupabase();
  const next = safeNext(str(fd, "next"), "/legacy");
  const code = str(fd, "code").replace(/\s+/g, "");
  const back = (err: unknown): never => fail("/mfa", err, next);
  if (!/^\d{6}$/.test(code)) back(new DomainError("validation", "Please enter the 6-digit code from your authenticator app."));
  const s = await readSession();
  const tokens = await readProviderSession();
  if (!s || !tokens) redirect(`/sign-in?next=${encodeURIComponent(`/mfa?next=${next}`)}`);
  try {
    let factorId = str(fd, "factorId");
    if (!factorId) factorId = (await goTrue().getUser(tokens.accessToken)).verifiedTotpFactorId ?? "";
    if (!UUID_RE.test(factorId)) throw new DomainError("validation", "Please set up your authenticator app first.");
    const upgraded = await goTrue().verifyTotp(tokens.accessToken, factorId, code);
    const claims = await verifyProviderToken(upgraded.accessToken);
    if (claims.aal !== "aal2") throw new AuthProviderError("not_upgraded", "That code did not work. Please try again.", 400);
    await writeProviderSession(upgraded, { accountId: s.accountId, sub: claims.sub, aal: "aal2" });
  } catch (err) {
    back(err);
  }
  redirect(next);
}
