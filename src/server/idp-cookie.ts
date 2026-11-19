import { AuthProviderError, goTrue, type ProviderSession } from "./supabase-auth";

/** Cookie holding the identity provider's tokens (supabase mode, ADR-015). HTTP-only; never sent to scripts. */
export const IDP_COOKIE = "eom_idp";
export const SESSION_COOKIE = "eom_session";
export const MAX_AGE_S = 60 * 60 * 8;

export function encodeProviderSession(s: ProviderSession): string {
  return Buffer.from(JSON.stringify({ a: s.accessToken, r: s.refreshToken })).toString("base64url");
}

export function decodeProviderSession(raw: string | undefined): ProviderSession | null {
  if (!raw || raw.length > 6000) return null;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { a?: unknown; r?: unknown };
    return typeof v.a === "string" && typeof v.r === "string" ? { accessToken: v.a, refreshToken: v.r } : null;
  } catch {
    return null;
  }
}

/** Reads a token's expiry WITHOUT verifying it: used only to decide when to refresh. */
export function unverifiedExpiry(accessToken: string): number | null {
  const p = accessToken.split(".")[1];
  if (!p) return null;
  try {
    const exp = (JSON.parse(Buffer.from(p, "base64url").toString("utf8")) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

/**
 * Refreshes the provider session when the access token is within `windowS` seconds of expiry.
 * Returns undefined (no change), a new cookie value, or null (the provider ended the session: clear it).
 * A network failure leaves the cookie alone; the expired token is then simply refused on use.
 */
export async function refreshIfDue(raw: string | undefined, windowS = 120, now = Math.floor(Date.now() / 1000)): Promise<string | null | undefined> {
  const s = decodeProviderSession(raw);
  if (!s) return raw ? null : undefined;
  const exp = unverifiedExpiry(s.accessToken);
  if (exp !== null && exp - now > windowS) return undefined;
  try {
    return encodeProviderSession(await goTrue().refresh(s.refreshToken));
  } catch (err) {
    if (err instanceof AuthProviderError && err.status >= 400 && err.status < 500) return null;
    return undefined;
  }
}
