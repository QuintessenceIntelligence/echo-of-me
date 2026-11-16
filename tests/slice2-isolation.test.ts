/**
 * Cross-family isolation for the vault (hard gate H5 / AC-08 foundation). Family B attempts every
 * slice-2 operation against family A's legacy, items, recordings and tags, through the application and
 * through raw SQL as the application role. A recipient who joined A's legacy also tries to read it.
 * Expected: 0 successes; every application-level attempt audited as denied; A's data unchanged.
 */
import { describe, expect, it } from "vitest";
import { MfaRequiredError, NotFoundError } from "../src/domain/errors";
import { exportLegacy } from "../src/domain/export";
import { acceptInvitation, addRecipient, createLegacy, inviteRecipient } from "../src/domain/onboarding";
import {
  addMedia,
  addTag,
  citableSources,
  createMemory,
  decideTag,
  deleteMedia,
  deleteMemory,
  editMemory,
  getMemory,
  listMemories,
  readMedia,
  recordMachineTranscript,
  saveTranscript,
  setAudience,
  setMemoryApproval,
  setSensitivity,
  setTranscriptApproval,
  suggestTags,
} from "../src/domain/vault";
import { useTempBlobStore, wav } from "./fixtures";
import { docIdFor, makePerson, rawAs, rawSystem, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();
useTempBlobStore();
const ALL = ["terms_of_service", "privacy_notice", "audio_recording", "ai_processing", "share_with_recipients"] as const;
const VAULT_TABLES = ["memory_item", "memory_version", "media_asset", "transcript", "transcript_version", "memory_tag", "memory_audience", "citable_source"];

async function twoFamilies() {
  const a = await makePerson("vaultA", [...ALL]);
  const b = await makePerson("vaultB", [...ALL]);
  const { legacyId: legacyA } = await createLegacy(a, { title: "A", authorDisplayName: "A" });
  const { legacyId: legacyB } = await createLegacy(b, { title: "B", authorDisplayName: "B" });
  const { recipientId: recipientA } = await addRecipient(a, legacyA, { displayName: "A-son", relationship: "child", isMinor: false, email: `ason.${Date.now()}@example.test` });
  const { recipientId: recipientB } = await addRecipient(b, legacyB, { displayName: "B-son", relationship: "child", isMinor: false });
  const { memoryId: memA } = await createMemory(a, legacyA, { kind: "memory", title: "A secret", body: "Only for A's family: save money." });
  const { assetId: assetA } = await addMedia(a, legacyA, memA, { bytes: wav(), capture: "upload" });
  await saveTranscript(a, legacyA, assetA, { text: "A's words", expectedVersion: 0, approve: true });
  const { tagId: tagA } = await addTag(a, legacyA, memA, { kind: "theme", label: "family" });
  await suggestTags(a, legacyA, memA);
  const suggestedA = (await getMemory(a, legacyA, memA)).tags.find((t) => t.state === "suggested")!.id;
  await setMemoryApproval(a, legacyA, memA, true, 1);
  const { memoryId: memB } = await createMemory(b, legacyB, { kind: "memory", title: "B's own", body: "B" });
  return { a, b, legacyA, legacyB, recipientA, recipientB, memA, assetA, tagA, suggestedA, memB };
}

async function snapshotA(legacyA: string) {
  const out: Record<string, unknown[]> = {};
  for (const t of VAULT_TABLES.filter((t) => t !== "citable_source")) {
    out[t] = await rawSystem(pool(), `select * from ${t} where legacy_id = $1 order by 1, 2`, [legacyA]);
  }
  return JSON.stringify(out);
}

describe("Vault isolation through the application", () => {
  it("every operation by another family is refused as 'not found', audited, and changes nothing", async () => {
    const f = await twoFamilies();
    const { b, legacyA, legacyB, memA, assetA, tagA, suggestedA, recipientA, memB } = f;
    const before = await snapshotA(legacyA);

    const attempts: [string, () => Promise<unknown>][] = [
      ["memory.create", () => createMemory(b, legacyA, { kind: "memory", title: "x", body: "y" })],
      ["memory.edit", () => editMemory(b, legacyA, memA, { expectedVersion: 1, title: "x", body: "y" })],
      ["memory.edit(own legacy id)", () => editMemory(b, legacyB, memA, { expectedVersion: 1, title: "x", body: "y" })],
      ["memory.approve", () => setMemoryApproval(b, legacyA, memA, true, 1)],
      ["memory.unapprove(own legacy id)", () => setMemoryApproval(b, legacyB, memA, false, 1)],
      ["memory.sensitivity", () => setSensitivity(b, legacyA, memA, "sensitive")],
      ["memory.audience", () => setAudience(b, legacyA, memA, [])],
      ["memory.audience(A's recipient on B's item)", () => setAudience(b, legacyB, memB, [recipientA])],
      ["memory.delete", () => deleteMemory(b, legacyA, memA)],
      ["memory.delete(own legacy id)", () => deleteMemory(b, legacyB, memA)],
      ["media.add", () => addMedia(b, legacyA, memA, { bytes: wav(), capture: "upload" })],
      ["media.add(own legacy id)", () => addMedia(b, legacyB, memA, { bytes: wav(), capture: "upload" })],
      ["media.read", () => readMedia(b, assetA)],
      ["media.delete", () => deleteMedia(b, legacyA, assetA)],
      ["media.delete(own legacy id)", () => deleteMedia(b, legacyB, assetA)],
      ["transcript.save", () => saveTranscript(b, legacyA, assetA, { text: "x", expectedVersion: 1 })],
      ["transcript.save(own legacy id)", () => saveTranscript(b, legacyB, assetA, { text: "x", expectedVersion: 1 })],
      ["transcript.machine", () => recordMachineTranscript(b, legacyA, assetA, "x")],
      ["transcript.unapprove", () => setTranscriptApproval(b, legacyA, assetA, false, 1)],
      ["tag.add", () => addTag(b, legacyA, memA, { kind: "theme", label: "x" })],
      ["tag.approve", () => decideTag(b, legacyA, suggestedA, "approved")],
      ["tag.reject(own legacy id)", () => decideTag(b, legacyB, suggestedA, "rejected")],
      ["tag.suggest", () => suggestTags(b, legacyA, memA)],
      ["read.list", () => listMemories(b, legacyA)],
      ["read.detail", () => getMemory(b, legacyA, memA)],
      ["read.detail(own legacy id)", () => getMemory(b, legacyB, memA)],
      ["read.citable", () => citableSources(b, legacyA)],
      ["legacy.export", () => exportLegacy(b, legacyA)],
    ];
    const results: string[] = [];
    for (const [name, attempt] of attempts) {
      const r = await attempt().then(
        () => "SUCCEEDED",
        (e) => (e instanceof NotFoundError ? "not_found" : `other:${(e as Error).message}`),
      );
      results.push(`${name}=${r}`);
    }
    expect(results.filter((r) => !r.endsWith("=not_found"))).toEqual([]);
    expect(await snapshotA(legacyA)).toBe(before);
    expect((await citableSources(f.a, legacyA)).length).toBe(3);

    const denied = await rawSystem<{ n: number }>(pool(), "select count(*)::int as n from audit_event where actor_account_id = $1 and outcome = 'denied'", [b.accountId]);
    // Every write attempt (not the pure reads, which cannot change anything) leaves a denied record.
    expect(denied[0].n).toBe(attempts.filter(([n]) => !n.startsWith("read.") && n !== "media.read").length);
    // Nothing about A's legacy was written into B's view of the world.
    expect(await listMemories(b, legacyB)).toHaveLength(1);
    // Export refusal for a non-owner is 'not found' even with MFA; without MFA it is MFA first.
    await expect(exportLegacy({ accountId: b.accountId, aal: "aal1" }, legacyA)).rejects.toBeInstanceOf(MfaRequiredError);
  });
});

describe("Vault isolation in the database (raw SQL as the application role)", () => {
  it("another family sees none of A's rows and cannot write, update or delete them", async () => {
    const { b, legacyA, legacyB, memA, assetA, tagA } = await twoFamilies();
    for (const t of VAULT_TABLES) {
      expect(await rawAs(pool(), b.accountId, `select * from ${t} where legacy_id = $1`, [legacyA])).toHaveLength(0);
    }
    const writes = [
      ["insert into memory_item (legacy_id, kind, created_by) values ($1, 'memory', $2)", [legacyA, b.accountId]],
      ["insert into memory_version (memory_id, legacy_id, version_no, title, created_by) values ($1, $2, 9, 'x', $3)", [memA, legacyA, b.accountId]],
      ["insert into memory_tag (legacy_id, memory_id, kind, label, origin, state, decided_at) values ($1, $2, 'theme', 'x', 'author', 'approved', now())", [legacyA, memA]],
      ["insert into memory_audience (memory_id, recipient_id, legacy_id) values ($1, gen_random_uuid(), $2)", [memA, legacyA]],
      ["insert into transcript_version (media_asset_id, legacy_id, version_no, text, origin, created_by) values ($1, $2, 9, 'x', 'author_typed', $3)", [assetA, legacyA, b.accountId]],
    ] as const;
    for (const [sql, params] of writes) {
      await expect(rawAs(pool(), b.accountId, sql, [...params])).rejects.toThrow(/row-level security|violates|permission denied/);
    }
    // Updates and deletes silently match nothing.
    const changed = [
      await rawAs(pool(), b.accountId, "update memory_item set approval = 'draft', approved_version = null, approved_at = null where id = $1 returning id", [memA]),
      await rawAs(pool(), b.accountId, "update memory_tag set state = 'rejected', decided_at = now() where id = $1 returning id", [tagA]),
      await rawAs(pool(), b.accountId, "update transcript set approval = 'draft', approved_at = null where media_asset_id = $1 returning media_asset_id", [assetA]),
      await rawAs(pool(), b.accountId, "delete from memory_item where id = $1 returning id", [memA]),
      await rawAs(pool(), b.accountId, "delete from media_asset where id = $1 returning id", [assetA]),
      await rawAs(pool(), b.accountId, "delete from memory_tag where id = $1 returning id", [tagA]),
    ];
    expect(changed.every((r) => r.length === 0)).toBe(true);
    // B may not move its own rows into A's legacy either.
    await expect(rawAs(pool(), b.accountId, "update memory_item set legacy_id = $1 where legacy_id = $2", [legacyA, legacyB])).rejects.toThrow(/row-level security|violates/);
    // No session: nothing at all.
    for (const t of VAULT_TABLES) expect(await rawAs(pool(), null, `select * from ${t}`)).toHaveLength(0);
  });

  it("composite keys stop an owner from linking rows across legacies, even with full rights on both", async () => {
    const { a, legacyA, memA } = await twoFamilies();
    const { legacyId: secondA } = await createLegacy(a, { title: "A2", authorDisplayName: "A" });
    const { recipientId: otherRecipient } = await addRecipient(a, secondA, { displayName: "x", relationship: "friend", isMinor: false });
    await expect(
      rawAs(pool(), a.accountId, "insert into memory_audience (memory_id, recipient_id, legacy_id) values ($1, $2, $3)", [memA, otherRecipient, legacyA]),
    ).rejects.toThrow(/foreign key/);
    await expect(
      rawAs(pool(), a.accountId, "insert into memory_version (memory_id, legacy_id, version_no, title, created_by) values ($1, $2, 2, 'x', $3)", [memA, secondA, a.accountId]),
    ).rejects.toThrow(/foreign key/);
    await expect(
      rawAs(pool(), a.accountId, "insert into media_asset (legacy_id, memory_id, kind, mime_type, byte_size, sha256, storage_key, capture, created_by) values ($1, $2, 'audio', 'audio/wav', 1, repeat('a', 64), 'x', 'upload', $3)", [legacyA, memA, a.accountId]),
    ).rejects.toThrow(/storage_key_scoped/);
  });

  it("a recipient who joined the legacy still sees nothing of the vault (AC-02)", async () => {
    const { a, legacyA, recipientA, memA } = await twoFamilies();
    const email = (await rawSystem<{ email: string }>(pool(), "select email from recipient where id = $1", [recipientA]))[0].email;
    await setAudience(a, legacyA, memA, [recipientA]);
    const { token } = await inviteRecipient(a, legacyA, recipientA);
    const { provisionAccount } = await import("../src/domain/onboarding");
    const { accountId } = await provisionAccount({ authSubject: `test|${email}`, email, displayName: "Son" });
    const son = { accountId, aal: "aal2" as const };
    await acceptInvitation(son, token, await docIdFor("recipient_terms"));
    for (const t of VAULT_TABLES) expect(await rawAs(pool(), son.accountId, `select * from ${t}`)).toHaveLength(0);
    await expect(getMemory(son, legacyA, memA)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listMemories(son, legacyA)).rejects.toBeInstanceOf(NotFoundError);
    await expect(citableSources(son, legacyA)).rejects.toBeInstanceOf(NotFoundError);
  });
});
