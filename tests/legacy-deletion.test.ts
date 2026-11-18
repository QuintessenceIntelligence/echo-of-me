/**
 * AC-12 (remainder): the author can delete the whole legacy; deletion reaches every derived record and file,
 * while the consent history and minimised activity log remain.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deleteLegacy } from "../src/domain/deletion";
import { exportLegacy } from "../src/domain/export";
import { MfaRequiredError, NotFoundError, ValidationError } from "../src/domain/errors";
import { acceptInvitation, addRecipient, addTrustedContact, completeOnboarding, createLegacy, inviteRecipient } from "../src/domain/onboarding";
import { pinAnswer, recipientAsk, rehearse } from "../src/domain/rehearsal";
import { listSharedItems, myMemberships, reportAnswer, setItemShares } from "../src/domain/sharing";
import { addMedia, addTag, citableSources, createMemory, readMedia, saveTranscript, setAudience, setMemoryApproval } from "../src/domain/vault";
import { useTempBlobStore, wav } from "./fixtures";
import { docIdFor, makePerson, rawSystem, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();
const blobDir = useTempBlobStore();
const AUTHOR = ["terms_of_service", "privacy_notice", "audio_recording", "ai_processing", "share_with_recipients"] as const;
const LEGACY_TABLES = [
  "memory_item", "memory_version", "media_asset", "transcript", "transcript_version", "memory_tag", "memory_audience",
  "rehearsal_turn", "answer_rule", "share_grant", "recipient_turn", "answer_report", "recipient", "invitation", "trusted_contact",
];

async function fullLegacy(label: string) {
  const a = await makePerson(label, [...AUTHOR]);
  const { legacyId } = await createLegacy(a, { title: `${label} legacy`, authorDisplayName: "Dad" });
  await completeOnboarding(a, legacyId);
  const son = await makePerson(`${label}Son`);
  const { recipientId } = await addRecipient(a, legacyId, { displayName: "Son", relationship: "child", isMinor: false, email: son.email });
  const { token } = await inviteRecipient(a, legacyId, recipientId);
  await acceptInvitation(son, token, await docIdFor("recipient_terms"));
  await addTrustedContact(a, legacyId, { displayName: "Uncle", email: "uncle@example.test", relationship: "brother" });
  const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Saving money", body: "Save a tenth first.", approve: true });
  const { assetId } = await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" });
  await saveTranscript(a, legacyId, assetId, { text: "Save a tenth.", expectedVersion: 0, approve: true });
  await addTag(a, legacyId, memoryId, { kind: "theme", label: "money" });
  await setMemoryApproval(a, legacyId, memoryId, true, 1); // adding the recording returned it to draft
  await setAudience(a, legacyId, memoryId, [recipientId]);
  await setItemShares(a, legacyId, memoryId, [recipientId]);
  const q = await rehearse(a, legacyId, "How should I save money?");
  await pinAnswer(a, legacyId, q.turnId, memoryId);
  const ra = await recipientAsk(son, legacyId, "How should I save money?");
  await reportAnswer(son, legacyId, ra.turnId, { reason: "other", includeQuestion: true });
  return { a, son, legacyId, memoryId, assetId };
}

describe("Export before deletion includes slices 4 and 5", () => {
  it("contains sharing, answer rules, practice questions and reports, but not recipients' own questions", async () => {
    const f = await fullLegacy("delExport");
    const { manifest } = await exportLegacy(f.a, f.legacyId);
    const mem = manifest.memories[0] as Record<string, any>;
    expect(mem.shared_with).toHaveLength(1);
    expect(manifest.answer_rules).toEqual([expect.objectContaining({ action: "pin", question: "How should I save money?", memory_id: f.memoryId })]);
    expect(manifest.practice_questions.map((t: any) => t.question)).toContain("How should I save money?");
    expect(manifest.reports_received).toEqual([expect.objectContaining({ reason: "other", question: "How should I save money?" })]);
    // Recipients' own questions are theirs: no list of them, and log entries carry ids and counts only.
    expect(Object.keys(manifest)).not.toContain("recipient_questions");
    expect(manifest.activity_log.every((e: any) => !JSON.stringify(e.detail).includes("save money"))).toBe(true);
  });
});

describe("Deleting a whole legacy", () => {
  it("needs a second factor and the exact title, and only the owner can do it", async () => {
    const f = await fullLegacy("delGuard");
    const other = await makePerson("delOther", [...AUTHOR]);
    await expect(deleteLegacy({ accountId: f.a.accountId, aal: "aal1" }, f.legacyId, "delGuard legacy")).rejects.toBeInstanceOf(MfaRequiredError);
    await expect(deleteLegacy(f.a, f.legacyId, "wrong title")).rejects.toBeInstanceOf(ValidationError);
    await expect(deleteLegacy(other, f.legacyId, "delGuard legacy")).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteLegacy(f.son, f.legacyId, "delGuard legacy")).rejects.toBeInstanceOf(NotFoundError);
    expect(await rawSystem(pool(), "select 1 from legacy where id = $1", [f.legacyId])).toHaveLength(1);
    const denied = await rawSystem<{ n: number }>(pool(), "select count(*)::int as n from audit_event where action = 'legacy.delete' and outcome = 'denied' and legacy_id = $1", [f.legacyId]);
    expect(denied[0].n).toBe(3); // no second factor, another author, a recipient (a wrong title is a form error, not a refusal)
  });

  it("removes every record and file of the legacy, ends recipients' access, and keeps the minimised audit trail", async () => {
    const f = await fullLegacy("delAll");
    const keep = await fullLegacy("delKeep"); // another family: must be untouched
    const before = (await rawSystem<{ n: number }>(pool(), "select count(*)::int as n from memory_item where legacy_id = $1", [keep.legacyId]))[0].n;
    expect(existsSync(join(blobDir(), f.legacyId, f.assetId))).toBe(true);

    expect(await deleteLegacy(f.a, f.legacyId, "  delAll legacy ")).toEqual({ items: 1, files: 1 });

    expect(await rawSystem(pool(), "select 1 from legacy where id = $1", [f.legacyId])).toHaveLength(0);
    for (const t of LEGACY_TABLES) {
      expect(await rawSystem(pool(), `select 1 from ${t} where legacy_id = $1`, [f.legacyId])).toHaveLength(0);
    }
    expect(existsSync(join(blobDir(), f.legacyId))).toBe(false);
    await expect(readMedia(f.a, f.assetId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listSharedItems(f.son, f.legacyId)).rejects.toBeInstanceOf(NotFoundError);
    expect(await myMemberships(f.son)).toEqual([]);
    await expect(citableSources(f.a, f.legacyId)).rejects.toBeInstanceOf(NotFoundError);

    // What remains: consent history and the activity log (ids and counts, no content).
    const log = await rawSystem<{ action: string; detail: Record<string, unknown> }>(pool(), "select action, detail from audit_event where legacy_id = $1 order by occurred_at", [f.legacyId]);
    expect(log.find((e) => e.action === "legacy.delete")).toMatchObject({ detail: { items: 1, recipients: 1, files: 1 } });
    // Later attempts by the former recipient are refused and logged too.
    expect(log.some((e) => e.action === "shared.view")).toBe(true);
    expect(JSON.stringify(log)).not.toMatch(/tenth|Saving money|How should I save/);
    expect((await rawSystem(pool(), "select 1 from consent_event where account_id = $1", [f.a.accountId])).length).toBeGreaterThan(0);

    // The other family is untouched; the author can start again.
    expect((await rawSystem<{ n: number }>(pool(), "select count(*)::int as n from memory_item where legacy_id = $1", [keep.legacyId]))[0].n).toBe(before);
    expect(existsSync(join(blobDir(), keep.legacyId, keep.assetId))).toBe(true);
    expect((await listSharedItems(keep.son, keep.legacyId)).items).toHaveLength(1);
    await expect(createLegacy(f.a, { title: "A fresh start", authorDisplayName: "Dad" })).resolves.toHaveProperty("legacyId");
  });
});
