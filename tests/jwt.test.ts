/**
 * Supabase access-token verification (ADR-015): signature, algorithm, key and claim checks, and JWKS
 * caching. Offline: keys are generated here and served from an in-memory JWKS.
 */
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";
import { remoteJwks, TokenError, verifyAccessToken, type JwksSource } from "../src/server/jwt";

const ISS = "https://projectref.supabase.co/auth/v1";
const SUB = "565dafb5-fd66-4274-9c37-f0ff720f5637";
const now = () => Math.floor(Date.now() / 1000);

function ecKey(kid: string) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "ES256", use: "sig" } };
}
function rsaKey(kid: string, bits = 2048) {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: bits });
  return { kid, privateKey, jwk: { ...publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" } };
}
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

function token(key: { kid: string; privateKey: KeyObject }, claims: Record<string, unknown> = {}, header: Record<string, unknown> = {}) {
  const alg = (header.alg as string) ?? (key.privateKey.asymmetricKeyType === "ec" ? "ES256" : "RS256");
  const h = b64({ alg, typ: "JWT", kid: key.kid, ...header });
  const p = b64({ iss: ISS, sub: SUB, aud: "authenticated", role: "authenticated", aal: "aal1", email: "Someone@Example.test", session_id: "s-1", iat: now(), exp: now() + 3600, ...claims });
  const data = Buffer.from(`${h}.${p}`);
  const sig = alg === "ES256" ? sign("sha256", data, { key: key.privateKey, dsaEncoding: "ieee-p1363" }) : sign("sha256", data, key.privateKey);
  return `${h}.${p}.${sig.toString("base64url")}`;
}

function staticJwks(...keys: object[]): JwksSource & { calls: number } {
  const src = { calls: 0, keys: async () => { src.calls += 1; return keys as never; } };
  return src;
}

const verify = (t: string, jwks: JwksSource) => verifyAccessToken(t, { issuer: ISS, jwks });
const reason = async (p: Promise<unknown>) => ((await p.then(() => null, (e) => e)) as TokenError | null)?.reason;

describe("Access-token verification", () => {
  const es = ecKey("es-1");
  const rs = rsaKey("rs-1");
  const jwks = staticJwks(es.jwk, rs.jwk);

  it("accepts valid ES256 and RS256 tokens and returns only the claims the app uses", async () => {
    expect(await verify(token(es), jwks)).toEqual({ sub: SUB, email: "someone@example.test", aal: "aal1", sessionId: "s-1", exp: expect.any(Number) });
    expect((await verify(token(rs, { aal: "aal2" }), jwks)).aal).toBe("aal2");
  });

  it("refuses symmetric, unsigned and unknown algorithms", async () => {
    const t = token(es);
    const [, p, s] = t.split(".");
    expect(await reason(verify(`${b64({ alg: "HS256", typ: "JWT", kid: "es-1" })}.${p}.${s}`, jwks))).toBe("algorithm");
    expect(await reason(verify(`${b64({ alg: "none", typ: "JWT", kid: "es-1" })}.${p}.`, jwks))).toBe("algorithm");
    expect(await reason(verify(`${b64({ typ: "JWT", kid: "es-1" })}.${p}.${s}`, jwks))).toBe("algorithm");
  });

  it("refuses tampered payloads, signatures by other keys, and key/algorithm mismatches", async () => {
    const [h, , s] = token(es).split(".");
    const forged = b64({ iss: ISS, sub: SUB, aud: "authenticated", role: "authenticated", aal: "aal2", exp: now() + 3600 });
    expect(await reason(verify(`${h}.${forged}.${s}`, jwks))).toBe("signature");
    const impostor = ecKey("es-1"); // same key id, different private key
    expect(await reason(verify(token(impostor), jwks))).toBe("signature");
    const [, p2] = token(rs).split(".");
    const rsSig = token(rs).split(".")[2];
    expect(await reason(verify(`${b64({ alg: "RS256", typ: "JWT", kid: "es-1" })}.${p2}.${rsSig}`, jwks))).toBe("key_mismatch");
    expect(await reason(verify(token(es).slice(0, -2), jwks))).toBe("signature");
    expect(await reason(verify("a.b", jwks))).toBe("format");
    expect(await reason(verify("x".repeat(9000), jwks))).toBe("format");
  });

  it("checks expiry, not-before, issuer, audience, role, subject and assurance level", async () => {
    expect(await reason(verify(token(es, { exp: now() - 120 }), jwks))).toBe("expired");
    expect(await verify(token(es, { exp: now() - 10 }), jwks)).toBeTruthy(); // within 30 s leeway
    expect(await reason(verify(token(es, { nbf: now() + 600 }), jwks))).toBe("not_yet_valid");
    expect(await reason(verify(token(es, { iss: "https://evil.example/auth/v1" }), jwks))).toBe("issuer");
    expect(await reason(verify(token(es, { aud: "something-else" }), jwks))).toBe("audience");
    expect(await verify(token(es, { aud: ["x", "authenticated"] }), jwks)).toBeTruthy();
    expect(await reason(verify(token(es, { role: "anon" }), jwks))).toBe("role");
    expect(await reason(verify(token(es, { role: "service_role" }), jwks))).toBe("role");
    expect(await reason(verify(token(es, { sub: "not-a-uuid" }), jwks))).toBe("subject");
    expect(await reason(verify(token(es, { aal: undefined }), jwks))).toBe("assurance");
    expect(await reason(verify(token(es, { aal: "aal3" }), jwks))).toBe("assurance");
  });

  it("refuses weak RSA keys and ignores private members published by mistake", async () => {
    const weak = rsaKey("rs-weak", 1024);
    expect(await reason(verify(token(weak), staticJwks(weak.jwk)))).toBe("key_mismatch");
    const leaky = ecKey("es-leaky");
    const withPrivate = { ...leaky.jwk, d: leaky.privateKey.export({ format: "jwk" }).d };
    expect(await verify(token(leaky), staticJwks(withPrivate))).toBeTruthy();
  });

  it("refreshes the key set once for an unknown key id (rotation), and not more often than allowed", async () => {
    const old = ecKey("old");
    const rotated = ecKey("new");
    let served = [old.jwk];
    let fetches = 0;
    const fetchImpl = (async () => {
      fetches += 1;
      return new Response(JSON.stringify({ keys: served }), { status: 200 });
    }) as typeof fetch;
    const src = remoteJwks(`${ISS}/.well-known/jwks.json`, { fetchImpl, minRefreshMs: 0 });
    expect(await verify(token(old), src)).toBeTruthy();
    expect(await verify(token(old), src)).toBeTruthy();
    expect(fetches).toBe(1); // cached
    served = [old.jwk, rotated.jwk];
    expect(await verify(token(rotated), src)).toBeTruthy();
    expect(fetches).toBe(2); // one forced refresh

    const throttled = remoteJwks(`${ISS}/.well-known/jwks.json`, { fetchImpl, minRefreshMs: 60_000 });
    fetches = 0;
    for (let i = 0; i < 5; i++) expect(await reason(verify(token(ecKey(`made-up-${i}`)), throttled))).toBe("unknown_key");
    expect(fetches).toBe(1); // made-up key ids cannot make it refetch on every request
  });
});
