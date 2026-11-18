/**
 * Hardening: per-account rate limits (ADR-012, migration 0013).
 * Limits count attempts (including failed ones), are per account, reset per window, log only the first
 * refusal per window, and the table behind them is unreachable from the application role.
 */
import { afterEach, describe, expect, it } from "vitest";
import { PolicyError, ValidationError } from "../src/domain/errors";
import { exportLegacy } from "../src/domain/export";
import { LIMITS, resetLimitsForTests, setLimitForTests } from "../src/domain/limits";
import { addRecipient, completeOnboarding, createLegacy, getAuditLog, inviteRecipient } from "../src/domain/onboarding";
import { rehearse } from "../src/domain/rehearsal";
import { addMedia, createMemory } from "../src/domain/vault";
import { PNG_1PX, useTempBlobStore, wav } from "./fixtures";
import { makePerson, rawAs, rawSystem, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();
useTempBlobStore();
const C = ["terms_of_service", "privacy_notice", "audio_recording", "ai_processing", "share_with_recipients"] as const;

afterEach(() => resetLimitsForTests());

async function author(label: string) {
  const a = await makePerson(label, [...C]);
  const { legacyId } = await createLegacy(a, { title: "L", authorDisplayName: "Mum" });
  return { a, legacyId };
}

const isRateLimited = (e: unknown) => e instanceof PolicyError && e.code === "rate_limited";

describe("Rate limits (ADR-012)", () => {
  it("defaults are generous enough for real use", () => {
    expect(LIMITS.ask.max).toBeGreaterThanOrEqual(30);
    expect(LIMITS.upload.max).toBeGreaterThanOrEqual(20);
    for (const l of Object.values(LIMITS)) expect(l.windowSeconds).toBeLessThanOrEqual(86400);
  });

  it("refuses practice questions over the limit, per account, and only the first refusal is logged", async () => {
    setLimitForTests("ask", { max: 3, windowSeconds: 600 });
    const { a, legacyId } = await author("limitAsk");
    const { a: other, legacyId: otherLegacy } = await author("limitAskOther");
    for (let i = 0; i < 3; i++) await rehearse(a, legacyId, `What did you love about summer ${i}?`);
    for (let i = 0; i < 3; i++) {
      const err = await rehearse(a, legacyId, "One more question?").catch((e) => e);
      expect(isRateLimited(err)).toBe(true);
    }
    // Another account is unaffected.
    await expect(rehearse(other, otherLegacy, "What did you love about summer?")).resolves.toBeTruthy();
    const log = await getAuditLog(a, legacyId);
    const refusals = log.filter((e) => e.action === "rate_limit.refused");
    expect(refusals).toHaveLength(1);
    expect(refusals[0]).toMatchObject({ outcome: "denied" });
    expect(refusals[0].detail).toMatchObject({ limit: "ask", max: 3 });
    // Refused questions were not stored as practice turns.
    const turns = await rawSystem<{ n: number }>(pool(), "select count(*)::int as n from rehearsal_turn where legacy_id = $1", [legacyId]);
    expect(turns[0].n).toBe(3);
  });

  it("counts failed attempts too, so bad input cannot be used to hammer the server", async () => {
    setLimitForTests("upload", { max: 2, windowSeconds: 3600 });
    const { a, legacyId } = await author("limitUpload");
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Photo", body: "A photo." });
    const junk = Buffer.from("not a real file at all");
    await expect(addMedia(a, legacyId, memoryId, { bytes: junk, capture: "upload" })).rejects.toBeInstanceOf(ValidationError);
    await expect(addMedia(a, legacyId, memoryId, { bytes: junk, capture: "upload" })).rejects.toBeInstanceOf(ValidationError);
    const err = await addMedia(a, legacyId, memoryId, { bytes: PNG_1PX, capture: "upload" }).catch((e) => e);
    expect(isRateLimited(err)).toBe(true);
    const assets = await rawSystem<{ n: number }>(pool(), "select count(*)::int as n from media_asset where legacy_id = $1", [legacyId]);
    expect(assets[0].n).toBe(0);
  });

  it("allows the action again once the window has passed", async () => {
    setLimitForTests("upload", { max: 1, windowSeconds: 3600 });
    const { a, legacyId } = await author("limitWindow");
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Song", body: "A song." });
    await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" });
    expect(isRateLimited(await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" }).catch((e) => e))).toBe(true);
    await rawSystem(pool(), "update rate_limit set window_start = window_start - interval '61 minutes' where bucket = $1", [`upload:${a.accountId}`]);
    await expect(addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" })).resolves.toMatchObject({ mimeType: "audio/wav" });
  });

  it("applies to invitations and exports", async () => {
    setLimitForTests("invite", { max: 1, windowSeconds: 3600 });
    setLimitForTests("export", { max: 1, windowSeconds: 3600 });
    const { a, legacyId } = await author("limitInvite");
    await completeOnboarding(a, legacyId);
    const { recipientId } = await addRecipient(a, legacyId, { displayName: "Son", relationship: "child", isMinor: false, email: "son.limit@example.test" });
    await inviteRecipient(a, legacyId, recipientId);
    expect(isRateLimited(await inviteRecipient(a, legacyId, recipientId).catch((e) => e))).toBe(true);
    await exportLegacy(a, legacyId);
    expect(isRateLimited(await exportLegacy(a, legacyId).catch((e) => e))).toBe(true);
  });

  it("the application role cannot read or change the counters, and the function is scoped to the caller", async () => {
    const { a } = await author("limitRaw");
    await expect(rawAs(pool(), a.accountId, "select * from rate_limit")).rejects.toThrow(/permission denied/);
    await expect(rawAs(pool(), a.accountId, "delete from rate_limit")).rejects.toThrow(/permission denied/);
    await expect(rawAs(pool(), a.accountId, "insert into rate_limit values ('ask:x', now(), 0)")).rejects.toThrow(/permission denied/);
    // No account: refused. Bad arguments: refused.
    await expect(rawAs(pool(), null, "select app.rate_limit_hit('ask', 60)")).rejects.toThrow(/no account/);
    await expect(rawAs(pool(), a.accountId, "select app.rate_limit_hit('ask:' || $1, 60)", [a.accountId])).rejects.toThrow(/invalid rate limit/);
    await expect(rawAs(pool(), a.accountId, "select app.rate_limit_hit('ask', 0)")).rejects.toThrow(/invalid rate limit/);
    await expect(rawAs(pool(), a.accountId, "select app.rate_limit_hit('ask', 999999)")).rejects.toThrow(/invalid rate limit/);
    // A valid call only ever touches the caller's own bucket.
    const [{ hits }] = await rawAs<{ hits: number }>(pool(), a.accountId, "select app.rate_limit_hit('ask', 60) as hits");
    expect(hits).toBe(1);
  });
});
