/**
 * Minimal server-side client for Supabase Auth's REST API (ADR-015). The browser never talks to the
 * identity provider and never sees its tokens: sign-up, sign-in, refresh, sign-out and the TOTP second
 * factor all go through server actions, and tokens live only in HTTP-only cookies.
 *
 * Contract assumptions (to verify on the real project before relying on them; the test double in
 * tests/fake-gotrue.ts implements exactly these):
 *   POST /auth/v1/signup                         {email, password, data}            → user, or session
 *   POST /auth/v1/token?grant_type=password      {email, password}                  → session
 *   POST /auth/v1/token?grant_type=refresh_token {refresh_token}                    → session
 *   POST /auth/v1/logout?scope=local|global      (bearer)                           → 204
 *   GET  /auth/v1/user                           (bearer)                           → user with factors
 *   POST /auth/v1/factors                        {factor_type:"totp", friendly_name} → {id, totp:{qr_code, secret, uri}}
 *   DELETE /auth/v1/factors/{id}                 (bearer)
 *   POST /auth/v1/factors/{id}/challenge         (bearer)                           → {id}
 *   POST /auth/v1/factors/{id}/verify            {challenge_id, code}               → session (aal2)
 *   GET  /auth/v1/.well-known/jwks.json                                             → JWKS
 */

/** Minimum password length asked of people (the provider may enforce more). */
export const MIN_PASSWORD = 12;

export interface ProviderSession {
  accessToken: string;
  refreshToken: string;
}

export interface ProviderUser {
  id: string;
  email: string | null;
  displayName: string | null;
  /** The provider has confirmed the person controls this email address (invitations depend on it). */
  emailConfirmed: boolean;
  verifiedTotpFactorId: string | null;
  unverifiedTotpFactorIds: string[];
}

/** A refusal from the identity provider, with a message that is safe to show. */
export class AuthProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const FRIENDLY: Record<string, string> = {
  invalid_credentials: "Email or password is incorrect.",
  email_not_confirmed: "Please confirm your email address first, using the link we sent you, then sign in.",
  user_already_exists: "An account already uses this email address. Please sign in instead.",
  email_exists: "An account already uses this email address. Please sign in instead.",
  weak_password: "Please choose a stronger password (at least 12 characters, not a common one).",
  mfa_verification_failed: "That code did not work. Check the time on your phone and try the newest code.",
  mfa_challenge_expired: "That took too long. Please try again with a new code.",
  over_request_rate_limit: "Too many attempts. Please wait a few minutes and try again.",
  over_email_send_rate_limit: "Too many emails were sent. Please wait a little and try again.",
  refresh_token_not_found: "Your session has ended. Please sign in again.",
  refresh_token_already_used: "Your session has ended. Please sign in again.",
  session_not_found: "Your session has ended. Please sign in again.",
  signup_disabled: "New sign-ups are closed for this test version.",
};

export interface GoTrueConfig {
  url: string; // https://<project_ref>.supabase.co
  apiKey: string; // publishable (anon) key: public by design
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class GoTrue {
  readonly issuer: string;
  readonly jwksUrl: string;
  private readonly base: string;
  private readonly doFetch: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly cfg: GoTrueConfig) {
    let u: URL;
    try {
      u = new URL(cfg.url);
    } catch {
      throw new Error("Invalid SUPABASE_URL");
    }
    const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !(local && u.protocol === "http:")) throw new Error("SUPABASE_URL must use HTTPS");
    if (u.pathname !== "/" || u.search || u.hash || u.username) throw new Error("Invalid SUPABASE_URL");
    if (!cfg.apiKey) throw new Error("Supabase publishable key is missing");
    this.base = `${u.origin}/auth/v1`;
    this.issuer = this.base;
    this.jwksUrl = `${this.base}/.well-known/jwks.json`;
    this.doFetch = cfg.fetchImpl ?? fetch;
    this.timeoutMs = cfg.timeoutMs ?? 15_000;
  }

  private async call(path: string, init: { method: string; body?: unknown; token?: string }): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = { apikey: this.cfg.apiKey, accept: "application/json" };
    if (init.body !== undefined) headers["content-type"] = "application/json";
    if (init.token) headers.authorization = `Bearer ${init.token}`;
    let res: Response;
    try {
      res = await this.doFetch(`${this.base}${path}`, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(this.timeoutMs),
        redirect: "error",
      });
    } catch {
      throw new AuthProviderError("unreachable", "Sign-in is temporarily unavailable. Please try again shortly.", 503);
    }
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      /* non-JSON error page */
    }
    if (!res.ok) {
      const code = String(json.error_code ?? json.code ?? json.error ?? (res.status === 429 ? "over_request_rate_limit" : "provider_error"));
      throw new AuthProviderError(code, FRIENDLY[code] ?? "Sign-in did not work. Please try again.", res.status);
    }
    return json;
  }

  private session(json: Record<string, unknown>): ProviderSession {
    const a = json.access_token;
    const r = json.refresh_token;
    if (typeof a !== "string" || typeof r !== "string" || !a || !r) {
      throw new AuthProviderError("bad_response", "Sign-in did not work. Please try again.", 502);
    }
    return { accessToken: a, refreshToken: r };
  }

  async signUp(email: string, password: string, displayName: string): Promise<{ session: ProviderSession | null }> {
    const json = await this.call("/signup", { method: "POST", body: { email, password, data: { display_name: displayName } } });
    return { session: typeof json.access_token === "string" ? this.session(json) : null };
  }

  async signInWithPassword(email: string, password: string): Promise<ProviderSession> {
    return this.session(await this.call("/token?grant_type=password", { method: "POST", body: { email, password } }));
  }

  async refresh(refreshToken: string): Promise<ProviderSession> {
    return this.session(await this.call("/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: refreshToken } }));
  }

  async signOut(accessToken: string, scope: "local" | "global" = "local"): Promise<void> {
    await this.call(`/logout?scope=${scope}`, { method: "POST", token: accessToken }).catch(() => undefined);
  }

  async getUser(accessToken: string): Promise<ProviderUser> {
    const u = await this.call("/user", { method: "GET", token: accessToken });
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const factors = Array.isArray(u.factors) ? (u.factors as Record<string, unknown>[]) : [];
    const totp = factors.filter((f) => f.factor_type === "totp");
    return {
      id: String(u.id ?? ""),
      email: typeof u.email === "string" ? u.email.toLowerCase() : null,
      displayName: typeof meta.display_name === "string" ? meta.display_name : null,
      emailConfirmed: typeof u.email_confirmed_at === "string" && u.email_confirmed_at.length > 0,
      verifiedTotpFactorId: (totp.find((f) => f.status === "verified")?.id as string | undefined) ?? null,
      unverifiedTotpFactorIds: totp.filter((f) => f.status !== "verified").map((f) => String(f.id)),
    };
  }

  async enrollTotp(accessToken: string): Promise<{ factorId: string; qrCode: string; secret: string; uri: string }> {
    const j = await this.call("/factors", { method: "POST", token: accessToken, body: { factor_type: "totp", friendly_name: `Echo of Me ${new Date().toISOString().slice(0, 16)}`, issuer: "Echo of Me" } });
    const totp = (j.totp ?? {}) as Record<string, unknown>;
    if (typeof j.id !== "string" || typeof totp.qr_code !== "string" || typeof totp.secret !== "string") {
      throw new AuthProviderError("bad_response", "Setting up the authenticator did not work. Please try again.", 502);
    }
    return { factorId: j.id, qrCode: totp.qr_code, secret: totp.secret, uri: String(totp.uri ?? "") };
  }

  async removeFactor(accessToken: string, factorId: string): Promise<void> {
    await this.call(`/factors/${encodeURIComponent(factorId)}`, { method: "DELETE", token: accessToken });
  }

  async verifyTotp(accessToken: string, factorId: string, code: string): Promise<ProviderSession> {
    const f = encodeURIComponent(factorId);
    const ch = await this.call(`/factors/${f}/challenge`, { method: "POST", token: accessToken, body: {} });
    if (typeof ch.id !== "string") throw new AuthProviderError("bad_response", "That code did not work. Please try again.", 502);
    return this.session(await this.call(`/factors/${f}/verify`, { method: "POST", token: accessToken, body: { challenge_id: ch.id, code } }));
  }
}

let client: GoTrue | undefined;

export function goTrue(): GoTrue {
  client ??= new GoTrue({ url: process.env.SUPABASE_URL ?? "", apiKey: process.env.SUPABASE_PUBLISHABLE_KEY ?? "" });
  return client;
}

export function setGoTrueForTests(g: GoTrue | undefined): void {
  client = g;
}
