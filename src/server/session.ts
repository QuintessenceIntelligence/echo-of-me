import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuthContext } from "../domain/auth";
import { remoteJwks, verifyAccessToken, type AccessClaims, type JwksSource } from "./jwt";
import { decodeProviderSession, encodeProviderSession, IDP_COOKIE, MAX_AGE_S, SESSION_COOKIE } from "./idp-cookie";
import { goTrue, type ProviderSession } from "./supabase-auth";

/**
 * Session handling (ADR-004, ADR-015).
 *
 *  - AUTH_MODE=dev: development sign-in with a SIMULATED second factor, clearly labelled in the UI,
 *    never on a hosted deployment. The signed app cookie carries the account and assurance level.
 *  - AUTH_MODE=supabase: Supabase Auth. The signed app cookie binds the account to the identity
 *    provider's user id; the provider's tokens live in a separate HTTP-only cookie. On every request the
 *    access token's signature and claims are checked against the provider's published keys, and the
 *    assurance level (aal1/aal2) is taken from the token, never from our own cookie. proxy.ts refreshes
 *    the token shortly before it expires.
 *  - Any other mode: nobody is signed in.
 */
const COOKIE = SESSION_COOKIE;

export { authMode } from "./auth-mode";
import { authMode } from "./auth-mode";

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
  /** Identity-provider user id (supabase mode only). */
  sub?: string;
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_S,
});

export async function writeSession(ctx: AuthContext & { sub?: string }): Promise<void> {
  const body: SessionPayload = { accountId: ctx.accountId, aal: ctx.aal, exp: Date.now() + MAX_AGE_S * 1000, ...(ctx.sub ? { sub: ctx.sub } : {}) };
  const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, cookieOptions());
}

/** Stores the identity provider's tokens (supabase mode) next to the signed app session. */
export async function writeProviderSession(tokens: ProviderSession, account: { accountId: string; sub: string; aal: AuthContext["aal"] }): Promise<void> {
  (await cookies()).set(IDP_COOKIE, encodeProviderSession(tokens), cookieOptions());
  await writeSession(account);
}

export async function readProviderSession(): Promise<ProviderSession | null> {
  return decodeProviderSession((await cookies()).get(IDP_COOKIE)?.value);
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(IDP_COOKIE);
}

function readSigned(raw: string | undefined): SessionPayload | null {
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
    if (typeof p.accountId !== "string") return null;
    return p;
  } catch {
    return null;
  }
}

let jwks: JwksSource | undefined;
function providerKeys(): JwksSource {
  jwks ??= remoteJwks(goTrue().jwksUrl);
  return jwks;
}

/** Verifies an access token from the configured identity provider. */
export async function verifyProviderToken(accessToken: string): Promise<AccessClaims> {
  return verifyAccessToken(accessToken, { issuer: goTrue().issuer, jwks: providerKeys() });
}

export async function readSession(): Promise<AuthContext | null> {
  const jar = await cookies(); // read first so every caller is rendered per request
  const mode = authMode();
  if (mode === "unconfigured") return null;
  const p = readSigned(jar.get(COOKIE)?.value);
  if (!p) return null;
  if (mode === "dev") return p.sub ? null : { accountId: p.accountId, aal: p.aal };

  // supabase: the provider's token must be valid and belong to the same person as the app session.
  if (!p.sub) return null;
  const tokens = decodeProviderSession(jar.get(IDP_COOKIE)?.value);
  if (!tokens) return null;
  try {
    const claims = await verifyProviderToken(tokens.accessToken);
    if (claims.sub !== p.sub) return null;
    return { accountId: p.accountId, aal: claims.aal };
  } catch {
    return null;
  }
}

export async function requireSession(next = "/home"): Promise<AuthContext> {
  const s = await readSession();
  if (!s) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return s;
}
