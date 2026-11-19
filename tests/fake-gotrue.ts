/**
 * A small stand-in for Supabase Auth's REST API, for tests only (ADR-015). It implements exactly the
 * contract that src/server/supabase-auth.ts assumes, signs ES256 access tokens and serves a JWKS, and
 * checks real TOTP codes (RFC 6238). It is NOT evidence that the real service behaves the same way.
 *
 * Run standalone for browser tests:  npx tsx tests/fake-gotrue.ts <port> [accessTtlSeconds]
 * Test-only endpoints: POST /__test/confirm?email=, POST /__test/revoke?email=, GET /__test/stats
 */
import { createHmac, generateKeyPairSync, randomBytes, randomUUID, sign, type KeyObject } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export const FAKE_API_KEY = "sb_publishable_test_only";

interface Factor { id: string; secret: string; status: "unverified" | "verified" }
interface User { id: string; email: string; password: string; displayName: string | null; confirmed: boolean; factors: Factor[] }
interface Session { id: string; userId: string; aal: "aal1" | "aal2"; revoked: boolean }
interface Refresh { sessionId: string; used: boolean }

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function base32(buf: Buffer): string {
  let bits = 0, value = 0, out = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}
function unbase32(s: string): Buffer {
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, "").toUpperCase()) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits). */
export function totp(secret: string, at = Date.now(), step = 0): string {
  const counter = Math.floor(at / 1000 / 30) + step;
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", unbase32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

export interface FakeGoTrue {
  url: string;
  close(): Promise<void>;
  confirm(email: string): void;
  revokeAll(email: string): void;
  stats: { refreshes: number; signIns: number };
  users: Map<string, User>;
}

export async function startFakeGoTrue(opts: { port?: number; autoconfirm?: boolean; accessTtlS?: number } = {}): Promise<FakeGoTrue> {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const kid = `fake-${randomUUID().slice(0, 8)}`;
  const jwk = { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" };
  const users = new Map<string, User>();
  const sessions = new Map<string, Session>();
  const refreshes = new Map<string, Refresh>();
  const challenges = new Map<string, { factorId: string; expires: number }>();
  const stats = { refreshes: 0, signIns: 0 };
  const ttl = opts.accessTtlS ?? 3600;
  let base = "";

  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  function jwt(key: KeyObject, user: User, s: Session): string {
    const now = Math.floor(Date.now() / 1000);
    const h = b64({ alg: "ES256", typ: "JWT", kid });
    const p = b64({
      iss: `${base}/auth/v1`, sub: user.id, aud: "authenticated", role: "authenticated", email: user.email,
      aal: s.aal, amr: [{ method: s.aal === "aal2" ? "totp" : "password", timestamp: now }], session_id: s.id, iat: now, exp: now + ttl,
    });
    const sig = sign("sha256", Buffer.from(`${h}.${p}`), { key, dsaEncoding: "ieee-p1363" });
    return `${h}.${p}.${sig.toString("base64url")}`;
  }
  function issue(user: User, s: Session) {
    const refresh = randomBytes(16).toString("hex");
    refreshes.set(refresh, { sessionId: s.id, used: false });
    return { access_token: jwt(privateKey, user, s), token_type: "bearer", expires_in: ttl, refresh_token: refresh, user: { id: user.id, email: user.email } };
  }
  function bearer(req: IncomingMessage): { user: User; session: Session } | null {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? "");
    if (!m) return null;
    try {
      const claims = JSON.parse(Buffer.from(m[1].split(".")[1], "base64url").toString()) as { sub: string; session_id: string; exp: number };
      if (claims.exp < Date.now() / 1000) return null;
      const s = sessions.get(claims.session_id);
      const user = [...users.values()].find((u) => u.id === claims.sub);
      return s && !s.revoked && user ? { user, session: s } : null;
    } catch {
      return null;
    }
  }

  const server: Server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const send = (status: number, body?: object) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(body ? JSON.stringify(body) : undefined);
    };
    const err = (status: number, code: string) => send(status, { code: status, error_code: code, msg: code });
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    let body: Record<string, string> = {};
    try {
      body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    } catch {
      return err(400, "bad_json");
    }
    const url = new URL(req.url ?? "/", "http://x");
    const path = url.pathname;

    if (path.startsWith("/__test/")) {
      const email = (url.searchParams.get("email") ?? "").toLowerCase();
      if (path === "/__test/confirm") { const u = users.get(email); if (u) u.confirmed = true; return send(200, { ok: Boolean(u) }); }
      if (path === "/__test/revoke") { api.revokeAll(email); return send(200, { ok: true }); }
      if (path === "/__test/stats") return send(200, stats);
      return err(404, "not_found");
    }
    if (path === "/auth/v1/.well-known/jwks.json") return send(200, { keys: [jwk] });
    if (req.headers.apikey !== FAKE_API_KEY) return err(401, "no_api_key");

    if (path === "/auth/v1/signup" && req.method === "POST") {
      const email = String(body.email ?? "").toLowerCase();
      if (users.has(email)) return err(422, "user_already_exists");
      if (String(body.password ?? "").length < 6) return err(422, "weak_password");
      const data = (body.data ?? {}) as unknown as Record<string, string>;
      const u: User = { id: randomUUID(), email, password: String(body.password), displayName: data.display_name ?? null, confirmed: Boolean(opts.autoconfirm), factors: [] };
      users.set(email, u);
      if (!u.confirmed) return send(200, { id: u.id, email: u.email });
      const s: Session = { id: randomUUID(), userId: u.id, aal: "aal1", revoked: false };
      sessions.set(s.id, s);
      return send(200, issue(u, s));
    }
    if (path === "/auth/v1/token" && req.method === "POST") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const u = users.get(String(body.email ?? "").toLowerCase());
        if (!u || u.password !== body.password) return err(400, "invalid_credentials");
        if (!u.confirmed) return err(400, "email_not_confirmed");
        stats.signIns += 1;
        const s: Session = { id: randomUUID(), userId: u.id, aal: "aal1", revoked: false };
        sessions.set(s.id, s);
        return send(200, issue(u, s));
      }
      if (grant === "refresh_token") {
        const r = refreshes.get(String(body.refresh_token ?? ""));
        const s = r && sessions.get(r.sessionId);
        if (!r || r.used || !s || s.revoked) return err(400, "refresh_token_not_found");
        r.used = true;
        stats.refreshes += 1;
        const u = [...users.values()].find((x) => x.id === s.userId)!;
        return send(200, issue(u, s));
      }
      return err(400, "unsupported_grant_type");
    }

    const who = bearer(req);
    if (!who) return err(401, "bad_jwt");
    const { user, session } = who;
    if (path === "/auth/v1/logout" && req.method === "POST") {
      const scope = url.searchParams.get("scope") ?? "global";
      for (const s of sessions.values()) if (s.userId === user.id && (scope === "global" || s.id === session.id)) s.revoked = true;
      res.writeHead(204).end();
      return;
    }
    if (path === "/auth/v1/user" && req.method === "GET") {
      return send(200, { id: user.id, email: user.email, user_metadata: { display_name: user.displayName }, factors: user.factors.map((f) => ({ id: f.id, factor_type: "totp", status: f.status })) });
    }
    if (path === "/auth/v1/factors" && req.method === "POST") {
      if (body.factor_type !== "totp") return err(422, "unsupported_factor");
      if (user.factors.some((f) => f.status === "verified") && session.aal !== "aal2") return err(422, "insufficient_aal");
      const f: Factor = { id: randomUUID(), secret: base32(randomBytes(20)), status: "unverified" };
      user.factors.push(f);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#fff"/><text x="10" y="100" font-size="10">${f.id}</text></svg>`;
      return send(200, { id: f.id, type: "totp", totp: { qr_code: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`, secret: f.secret, uri: `otpauth://totp/Echo%20of%20Me:${encodeURIComponent(user.email)}?secret=${f.secret}&issuer=Echo%20of%20Me` } });
    }
    const fm = /^\/auth\/v1\/factors\/([0-9a-f-]{36})(\/challenge|\/verify)?$/.exec(path);
    const factor = fm ? user.factors.find((f) => f.id === fm[1]) : undefined;
    if (fm && !factor) return err(404, "mfa_factor_not_found");
    if (fm && factor && !fm[2] && req.method === "DELETE") {
      user.factors = user.factors.filter((f) => f.id !== factor.id);
      return send(200, { id: factor.id });
    }
    if (fm && factor && fm[2] === "/challenge" && req.method === "POST") {
      const id = randomUUID();
      challenges.set(id, { factorId: factor.id, expires: Date.now() + 5 * 60_000 });
      return send(200, { id, type: "totp", expires_at: Math.floor(Date.now() / 1000) + 300 });
    }
    if (fm && factor && fm[2] === "/verify" && req.method === "POST") {
      const ch = challenges.get(String(body.challenge_id ?? ""));
      challenges.delete(String(body.challenge_id ?? ""));
      if (!ch || ch.factorId !== factor.id || ch.expires < Date.now()) return err(422, "mfa_challenge_expired");
      const code = String(body.code ?? "");
      if (![-1, 0, 1].some((step) => totp(factor.secret, Date.now(), step) === code)) return err(422, "mfa_verification_failed");
      factor.status = "verified";
      session.aal = "aal2";
      return send(200, issue(user, session));
    }
    return err(404, "not_found");
  });

  await new Promise<void>((resolve) => server.listen(opts.port ?? 0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const api: FakeGoTrue = {
    url: base,
    close: () => new Promise((r) => server.close(() => r())),
    confirm: (email) => { const u = users.get(email.toLowerCase()); if (u) u.confirmed = true; },
    revokeAll: (email) => { const u = users.get(email.toLowerCase()); for (const s of sessions.values()) if (u && s.userId === u.id) s.revoked = true; },
    stats,
    users,
  };
  return api;
}

// Standalone: npx tsx tests/fake-gotrue.ts <port> [accessTtlSeconds]
if (process.argv[1]?.endsWith("fake-gotrue.ts")) {
  const port = Number(process.argv[2] ?? 54321);
  const accessTtlS = process.argv[3] ? Number(process.argv[3]) : undefined;
  startFakeGoTrue({ port, accessTtlS }).then((f) => console.log(`fake GoTrue on ${f.url}`));
}
