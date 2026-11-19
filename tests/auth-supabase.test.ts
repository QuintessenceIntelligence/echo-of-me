/**
 * Supabase sign-in (ADR-015): the REST client, token verification against the provider's JWKS, the
 * TOTP second factor, refresh and revocation. Runs against tests/fake-gotrue.ts, a stand-in that
 * implements the assumed contract; the real Supabase project is not contacted.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { authMode } from "../src/server/auth-mode";
import { decodeProviderSession, encodeProviderSession, refreshIfDue } from "../src/server/idp-cookie";
import { remoteJwks, verifyAccessToken } from "../src/server/jwt";
import { AuthProviderError, GoTrue, setGoTrueForTests } from "../src/server/supabase-auth";
import { FAKE_API_KEY, startFakeGoTrue, totp, type FakeGoTrue } from "./fake-gotrue";

let fake: FakeGoTrue;
let gt: GoTrue;
const verify = (token: string) => verifyAccessToken(token, { issuer: gt.issuer, jwks: remoteJwks(gt.jwksUrl) });
const err = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e)) as AuthProviderError;

beforeAll(async () => {
  fake = await startFakeGoTrue({ autoconfirm: false });
  gt = new GoTrue({ url: fake.url, apiKey: FAKE_API_KEY });
  setGoTrueForTests(gt);
});
afterAll(async () => {
  setGoTrueForTests(undefined);
  await fake.close();
});

describe("Mode selection", () => {
  it("uses Supabase only when fully configured; development sign-in never when hosted", () => {
    const sb = { AUTH_MODE: "supabase", SUPABASE_URL: "https://ref.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x" };
    expect(authMode(sb)).toBe("supabase");
    expect(authMode({ ...sb, VERCEL: "1" })).toBe("supabase");
    expect(authMode({ ...sb, SUPABASE_PUBLISHABLE_KEY: "" })).toBe("unconfigured");
    expect(authMode({ AUTH_MODE: "dev", VERCEL: "1" })).toBe("unconfigured");
    expect(authMode({ AUTH_MODE: "something" })).toBe("unconfigured");
  });

  it("refuses insecure or malformed provider URLs", () => {
    expect(() => new GoTrue({ url: "http://ref.supabase.co", apiKey: "k" })).toThrow(/HTTPS/);
    expect(() => new GoTrue({ url: "https://ref.supabase.co/auth/v1", apiKey: "k" })).toThrow(/Invalid/);
    expect(() => new GoTrue({ url: "https://ref.supabase.co", apiKey: "" })).toThrow(/key/);
  });
});

describe("Sign-up and sign-in", () => {
  it("requires email confirmation, then signs in with a verifiable aal1 token", async () => {
    const r = await gt.signUp("Ana@Example.test", "correct horse battery", "Ana");
    expect(r.session).toBeNull();
    expect((await err(gt.signInWithPassword("ana@example.test", "correct horse battery"))).code).toBe("email_not_confirmed");
    fake.confirm("ana@example.test");
    const s = await gt.signInWithPassword("ana@example.test", "correct horse battery");
    const claims = await verify(s.accessToken);
    expect(claims).toMatchObject({ email: "ana@example.test", aal: "aal1" });
    expect(await gt.getUser(s.accessToken)).toMatchObject({ displayName: "Ana", emailConfirmed: true });
  });

  it("maps refusals to plain messages without echoing what was typed", async () => {
    const wrong = await err(gt.signInWithPassword("ana@example.test", "not the password"));
    expect(wrong).toBeInstanceOf(AuthProviderError);
    expect(wrong.message).toBe("Email or password is incorrect.");
    expect(wrong.message).not.toContain("not the password");
    expect((await err(gt.signUp("ana@example.test", "another long password", "Ana"))).message).toMatch(/already uses this email/);
    const down = new GoTrue({ url: "http://127.0.0.1:9", apiKey: FAKE_API_KEY });
    expect((await err(down.signInWithPassword("a@b.test", "x"))).code).toBe("unreachable");
  });
});

describe("Authenticator app (TOTP)", () => {
  it("enrolls, rejects a wrong code, and upgrades the session to aal2 with the right one", async () => {
    await gt.signUp("ben@example.test", "a long enough password", "Ben");
    fake.confirm("ben@example.test");
    const s = await gt.signInWithPassword("ben@example.test", "a long enough password");
    const f = await gt.enrollTotp(s.accessToken);
    expect(f.qrCode).toMatch(/^data:image\/svg\+xml/);
    const wrong = (Number(totp(f.secret)) + 1) % 1_000_000;
    expect((await err(gt.verifyTotp(s.accessToken, f.factorId, String(wrong).padStart(6, "0")))).message).toMatch(/did not work/);
    const up = await gt.verifyTotp(s.accessToken, f.factorId, totp(f.secret));
    expect((await verify(up.accessToken)).aal).toBe("aal2");
    expect((await gt.getUser(up.accessToken)).verifiedTotpFactorId).toBe(f.factorId);
  });
});

describe("Refresh and revocation (proxy)", () => {
  it("refreshes only when due, rotates the refresh token, and clears a session the provider ended", async () => {
    await gt.signUp("cai@example.test", "yet another password", "Cai");
    fake.confirm("cai@example.test");
    const s = await gt.signInWithPassword("cai@example.test", "yet another password");
    const raw = encodeProviderSession(s);
    expect(await refreshIfDue(raw)).toBeUndefined(); // an hour left: nothing to do
    const before = fake.stats.refreshes;
    const due = await refreshIfDue(raw, 10_000); // treat as due
    expect(fake.stats.refreshes).toBe(before + 1);
    const next = decodeProviderSession(due!)!;
    expect(next.refreshToken).not.toBe(s.refreshToken);
    expect(await verify(next.accessToken)).toBeTruthy();
    expect(await refreshIfDue(raw, 10_000)).toBeNull(); // the old refresh token was used: session cleared
    fake.revokeAll("cai@example.test");
    expect(await refreshIfDue(due!, 10_000)).toBeNull(); // signed out everywhere
    expect(await refreshIfDue("garbage")).toBeNull();
    expect(await refreshIfDue(undefined)).toBeUndefined();
  });

  it("leaves the session alone when the provider cannot be reached", async () => {
    await gt.signUp("dee@example.test", "and one more password", "Dee");
    fake.confirm("dee@example.test");
    const raw = encodeProviderSession(await gt.signInWithPassword("dee@example.test", "and one more password"));
    setGoTrueForTests(new GoTrue({ url: "http://127.0.0.1:9", apiKey: FAKE_API_KEY }));
    expect(await refreshIfDue(raw, 10_000)).toBeUndefined();
    setGoTrueForTests(gt);
  });
});

describe("Password reset", () => {
  it("sends nothing distinguishable for unknown addresses, uses each link once, and needs the second step when set up", async () => {
    await gt.signUp("eve@example.test", "the original password", "Eve");
    fake.confirm("eve@example.test");
    await expect(gt.requestPasswordReset("nobody@example.test", "http://localhost/reset-password")).resolves.toBeUndefined();
    await gt.requestPasswordReset("eve@example.test", "http://localhost/reset-password");
    const { token_hash } = (await (await fetch(`${fake.url}/__test/last-recovery?email=eve@example.test`)).json()) as { token_hash: string };
    const s = await gt.verifyRecovery(token_hash);
    expect((await verify(s.accessToken)).aal).toBe("aal1");
    expect((await err(gt.verifyRecovery(token_hash))).message).toMatch(/expired or was already used/);
    await gt.updatePassword(s.accessToken, "a brand new password");
    expect((await err(gt.updatePassword(s.accessToken, "a brand new password"))).message).toMatch(/different from your current one/);
    const again = await gt.signInWithPassword("eve@example.test", "a brand new password");
    const f = await gt.enrollTotp(again.accessToken);
    await gt.verifyTotp(again.accessToken, f.factorId, totp(f.secret));
    const second = await gt.signInWithPassword("eve@example.test", "a brand new password");
    expect((await err(gt.updatePassword(second.accessToken, "yet another new password"))).code).toBe("insufficient_aal");
  });
});
