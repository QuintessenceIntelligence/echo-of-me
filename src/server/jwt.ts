import { createPublicKey, verify as cryptoVerify, type KeyObject, type webcrypto } from "node:crypto";

type JsonWebKey = webcrypto.JsonWebKey;

/**
 * Verification of Supabase Auth access tokens (ADR-015), with Node's own crypto and no JWT library.
 *
 * Only asymmetric signing keys are accepted (ES256, RS256), fetched from the project's JWKS endpoint
 * (<issuer>/.well-known/jwks.json). Symmetric "legacy JWT secret" tokens (HS256) are refused: the app
 * never holds a secret that could also mint tokens. Every claim the app relies on is checked here.
 */

export interface AccessClaims {
  sub: string;
  email: string | null;
  aal: "aal1" | "aal2";
  sessionId: string | null;
  exp: number;
}

export class TokenError extends Error {
  constructor(public readonly reason: string) {
    super(`invalid_token:${reason}`);
  }
}

type Jwk = JsonWebKey & { kid?: string; alg?: string; use?: string };
export interface JwksSource {
  /** Returns the key set; `force` asks for a fresh copy (unknown key id, after rotation). */
  keys(force: boolean): Promise<Jwk[]>;
}

const ALGS = new Set(["ES256", "RS256"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;

function b64json(part: string): Record<string, unknown> {
  if (!B64URL_RE.test(part)) throw new TokenError("encoding");
  try {
    const v = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error();
    return v as Record<string, unknown>;
  } catch {
    throw new TokenError("encoding");
  }
}

function keyFor(jwk: Jwk, alg: string): KeyObject | null {
  if (jwk.use && jwk.use !== "sig") return null;
  if (jwk.alg && jwk.alg !== alg) return null;
  if (alg === "ES256" && !(jwk.kty === "EC" && jwk.crv === "P-256")) return null;
  if (alg === "RS256" && jwk.kty !== "RSA") return null;
  try {
    // Only the public members are passed, so a JWKS that mistakenly contains private parts is still safe.
    const pub: JsonWebKey = alg === "ES256" ? { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y } : { kty: "RSA", n: jwk.n, e: jwk.e };
    const key = createPublicKey({ key: pub, format: "jwk" });
    if (alg === "RS256" && (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048) return null;
    return key;
  } catch {
    return null;
  }
}

export async function verifyAccessToken(
  token: string,
  opts: { issuer: string; jwks: JwksSource; now?: number; leewaySeconds?: number },
): Promise<AccessClaims> {
  if (typeof token !== "string" || token.length > 8192) throw new TokenError("format");
  const parts = token.split(".");
  if (parts.length !== 3) throw new TokenError("format");
  const [h, p, s] = parts;
  const header = b64json(h);
  const alg = header.alg;
  if (typeof alg !== "string" || !ALGS.has(alg)) throw new TokenError("algorithm");
  if (header.typ !== undefined && header.typ !== "JWT") throw new TokenError("type");
  const kid = header.kid;
  if (typeof kid !== "string" || !kid) throw new TokenError("kid");
  if (!B64URL_RE.test(s)) throw new TokenError("encoding");
  const signature = Buffer.from(s, "base64url");
  const signed = Buffer.from(`${h}.${p}`);

  let jwk = (await opts.jwks.keys(false)).find((k) => k.kid === kid);
  if (!jwk) jwk = (await opts.jwks.keys(true)).find((k) => k.kid === kid);
  if (!jwk) throw new TokenError("unknown_key");
  const key = keyFor(jwk, alg);
  if (!key) throw new TokenError("key_mismatch");
  const ok =
    alg === "ES256"
      ? signature.length === 64 && cryptoVerify("sha256", signed, { key, dsaEncoding: "ieee-p1363" }, signature)
      : cryptoVerify("sha256", signed, key, signature);
  if (!ok) throw new TokenError("signature");

  const c = b64json(p);
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const leeway = opts.leewaySeconds ?? 30;
  if (typeof c.exp !== "number" || c.exp + leeway < now) throw new TokenError("expired");
  if (typeof c.nbf === "number" && c.nbf - leeway > now) throw new TokenError("not_yet_valid");
  if (typeof c.iat === "number" && c.iat - leeway > now) throw new TokenError("issued_in_future");
  if (c.iss !== opts.issuer) throw new TokenError("issuer");
  const aud = c.aud;
  if (!(aud === "authenticated" || (Array.isArray(aud) && aud.includes("authenticated")))) throw new TokenError("audience");
  if (c.role !== "authenticated") throw new TokenError("role");
  if (typeof c.sub !== "string" || !UUID_RE.test(c.sub)) throw new TokenError("subject");
  if (c.aal !== "aal1" && c.aal !== "aal2") throw new TokenError("assurance");
  return {
    sub: c.sub.toLowerCase(),
    email: typeof c.email === "string" && c.email ? c.email.toLowerCase() : null,
    aal: c.aal,
    sessionId: typeof c.session_id === "string" ? c.session_id : null,
    exp: c.exp,
  };
}

/**
 * Fetches and caches a JWKS. Cached for `ttlMs`; a forced refresh (unknown key id) happens at most once
 * per `minRefreshMs`, so a flood of tokens with made-up key ids cannot flood the identity provider.
 */
export function remoteJwks(url: string, opts: { ttlMs?: number; minRefreshMs?: number; fetchImpl?: typeof fetch } = {}): JwksSource {
  const ttl = opts.ttlMs ?? 10 * 60_000;
  const minRefresh = opts.minRefreshMs ?? 60_000;
  const doFetch = opts.fetchImpl ?? fetch;
  let cached: Jwk[] = [];
  let fetchedAt = 0;
  let inflight: Promise<Jwk[]> | null = null;

  async function load(): Promise<Jwk[]> {
    const res = await doFetch(url, { signal: AbortSignal.timeout(10_000), headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`JWKS fetch failed (HTTP ${res.status})`);
    const body = (await res.json()) as { keys?: unknown };
    if (!Array.isArray(body.keys)) throw new Error("JWKS has no keys");
    cached = body.keys.filter((k): k is Jwk => Boolean(k) && typeof k === "object");
    fetchedAt = Date.now();
    return cached;
  }

  return {
    async keys(force: boolean) {
      const age = Date.now() - fetchedAt;
      const stale = fetchedAt === 0 || age > ttl;
      if (!stale && !(force && age >= minRefresh)) return cached;
      inflight ??= load().finally(() => {
        inflight = null;
      });
      return inflight;
    },
  };
}
