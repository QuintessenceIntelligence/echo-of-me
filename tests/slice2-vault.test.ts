/**
 * Vertical slice 2: memory capture and provenance (ADR-006).
 * Covers AC-03 (originals byte-identical), AC-04 (unapproved machine output never citable),
 * the AC-05 rule that changes take an item out of the citable set immediately, and the start of AC-12 (export).
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { withdrawConsent } from "../src/domain/consent";
import { ConsentRequiredError, MfaRequiredError, NotFoundError, PolicyError, ValidationError } from "../src/domain/errors";
import { exportLegacy } from "../src/domain/export";
import { sniffMime } from "../src/domain/media-type";
import { addRecipient, createLegacy } from "../src/domain/onboarding";
import { suggestThemes } from "../src/domain/suggest";
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
  IntegrityError,
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
import { buildZip } from "../src/server/zip";
import { PNG_1PX, useTempBlobStore, wav, webmLike } from "./fixtures";
import { makePerson, rawAs, rawSystem, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();
const blobDir = useTempBlobStore();
const FULL = ["terms_of_service", "privacy_notice", "audio_recording", "ai_processing", "share_with_recipients"] as const;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function author(consents: readonly string[] = FULL, aal: "aal1" | "aal2" = "aal2") {
  const a = await makePerson("author", [...consents] as never, aal);
  const { legacyId } = await createLegacy(a, { title: "Letters for my children", authorDisplayName: "Dad" });
  return { a, legacyId };
}

const actions = async (accountId: string) =>
  (await rawSystem<{ action: string; outcome: string }>(pool(), "select action, outcome from audit_event where actor_account_id = $1 order by occurred_at", [accountId]));

describe("Text memories and value statements (P2)", () => {
  it("a draft is kept but is not citable; approving makes exactly the current version citable", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "The day I failed my driving test", body: "I failed twice. The third time I slowed down." });
    let m = await getMemory(a, legacyId, memoryId);
    expect(m).toMatchObject({ approval: "draft", currentVersion: 1, textProvenance: "P2_author_written", citable: false });
    expect(await citableSources(a, legacyId)).toHaveLength(0);

    await setMemoryApproval(a, legacyId, memoryId, true, 1);
    const cited = await citableSources(a, legacyId);
    expect(cited).toHaveLength(1);
    expect(cited[0]).toMatchObject({ sourceType: "memory_version", provenance: "P2_author_written", text: "I failed twice. The third time I slowed down." });
    m = await getMemory(a, legacyId, memoryId);
    expect(m.citable).toBe(true);
    expect(m.approvedAt).not.toBeNull();
  });

  it("a value statement can be saved and approved in one step", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "value_statement", title: "Honesty", body: "Tell the truth, even when it costs you.", approve: true });
    const [s] = await citableSources(a, legacyId);
    expect(s).toMatchObject({ memoryId, provenance: "P2_author_written" });
    expect((await listMemories(a, legacyId))[0]).toMatchObject({ kind: "value_statement", approval: "approved" });
  });

  it("editing keeps every earlier version unchanged and takes the item out of answers until re-approved (AC-05)", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Money", body: "Save first, spend later.", approve: true });
    const r = await editMemory(a, legacyId, memoryId, { expectedVersion: 1, title: "Money", body: "Save a tenth first, then spend." });
    expect(r).toEqual({ version: 2, changed: true });
    const m = await getMemory(a, legacyId, memoryId);
    expect(m.approval).toBe("draft");
    expect(m.versions.map((v) => [v.versionNo, v.body])).toEqual([
      [2, "Save a tenth first, then spend."],
      [1, "Save first, spend later."],
    ]);
    expect(await citableSources(a, legacyId)).toHaveLength(0); // the old approved wording is no longer usable

    await editMemory(a, legacyId, memoryId, { expectedVersion: 2, title: "Money", body: "Save a tenth first, then spend.", approve: true });
    const cited = await citableSources(a, legacyId);
    expect(cited.map((c) => c.text)).toEqual(["Save a tenth first, then spend."]);
    expect((await getMemory(a, legacyId, memoryId)).currentVersion).toBe(2); // approving unchanged text adds no version
    const log = (await actions(a.accountId)).map((x) => x.action);
    expect(log).toEqual(expect.arrayContaining(["memory.create", "memory.approve", "memory.edit", "memory.unapprove"]));
  });

  it("refuses a save based on an out-of-date version, and approving an empty item", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Draft" });
    await editMemory(a, legacyId, memoryId, { expectedVersion: 1, title: "Draft", body: "First words" });
    await expect(editMemory(a, legacyId, memoryId, { expectedVersion: 1, title: "x", body: "y" })).rejects.toMatchObject({ code: "stale_version" });
    const { memoryId: empty } = await createMemory(a, legacyId, { kind: "memory", title: "Empty" });
    await expect(setMemoryApproval(a, legacyId, empty, true, 1)).rejects.toBeInstanceOf(ValidationError);
    await expect(createMemory(a, legacyId, { kind: "memory", title: "Empty", approve: true })).rejects.toBeInstanceOf(ValidationError);
  });

  it("stores the sensitivity flag and the intended audience, which grants nobody access", async () => {
    const { a, legacyId } = await author();
    const { recipientId } = await addRecipient(a, legacyId, { displayName: "Son", relationship: "child", isMinor: false, email: "son@example.test" });
    const { recipientId: minor } = await addRecipient(a, legacyId, { displayName: "Little one", relationship: "child", isMinor: true });
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Hard year", body: "We lost the house.", approve: true });
    await setSensitivity(a, legacyId, memoryId, "sensitive");
    await setAudience(a, legacyId, memoryId, [recipientId, minor]);
    const m = await getMemory(a, legacyId, memoryId);
    expect(m.sensitivity).toBe("sensitive");
    expect(m.audience).toBe("selected");
    expect(m.audienceRecipientIds.sort()).toEqual([recipientId, minor].sort());
    expect((await citableSources(a, legacyId))[0].sensitivity).toBe("sensitive");
    await setAudience(a, legacyId, memoryId, []);
    expect((await getMemory(a, legacyId, memoryId)).audience).toBe("only_me");
  });

  it("is refused when the legacy is not open for changes", async () => {
    const { a, legacyId } = await author();
    await rawSystem(pool(), "update legacy set state = 'frozen' where id = $1", [legacyId]);
    await expect(createMemory(a, legacyId, { kind: "memory", title: "x", body: "y" })).rejects.toMatchObject({ code: "legacy_locked" });
  });
});

describe("Original recordings and photos (P1, AC-03)", () => {
  it("needs the voice-recording consent for audio, and records the refusal", async () => {
    const { a, legacyId } = await author(["terms_of_service", "privacy_notice"]);
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Voice note" });
    await expect(addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" })).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(await actions(a.accountId)).toContainEqual({ action: "media.add", outcome: "denied" });
    // Photos do not need it.
    await expect(addMedia(a, legacyId, memoryId, { bytes: PNG_1PX, capture: "upload", filename: "porch.png" })).resolves.toMatchObject({ mimeType: "image/png" });
  });

  it("decides the type from the bytes and refuses unsupported or oversized files", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Files" });
    const bad = [
      Buffer.from("this is plain text pretending to be an mp3 file"),
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from("ftypisom"), Buffer.alloc(32)]), // MP4 video
    ];
    for (const bytes of bad) {
      await expect(addMedia(a, legacyId, memoryId, { bytes, capture: "upload", filename: "song.mp3" })).rejects.toBeInstanceOf(ValidationError);
    }
    const big = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(25 * 1024 * 1024)]);
    await expect(addMedia(a, legacyId, memoryId, { bytes: big, capture: "upload" })).rejects.toThrow(/too large/);
    await expect(addMedia(a, legacyId, memoryId, { bytes: PNG_1PX, capture: "browser_recording" })).rejects.toBeInstanceOf(ValidationError);
    expect((await getMemory(a, legacyId, memoryId)).media).toHaveLength(0);
    expect(sniffMime(webmLike())).toBe("audio/webm");
  });

  it("returns the original byte-identical after transcription, editing, approval and export", async () => {
    const { a, legacyId } = await author();
    const original = wav(0.5, 330);
    const originalSha = sha(original);
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Grandpa's farm", body: "Listen to this." });
    const added = await addMedia(a, legacyId, memoryId, { bytes: original, capture: "browser_recording", filename: "../../etc/passwd" });
    expect(added).toMatchObject({ mimeType: "audio/wav", sha256: originalSha, byteSize: original.length });

    await saveTranscript(a, legacyId, added.assetId, { text: "We grew maize.", expectedVersion: 0 });
    await saveTranscript(a, legacyId, added.assetId, { text: "We grew maize and pumpkins.", expectedVersion: 1, approve: true });
    await editMemory(a, legacyId, memoryId, { expectedVersion: 1, title: "Grandpa's farm", body: "Listen to this, it's my favourite.", approve: true });

    const back = await readMedia(a, added.assetId);
    expect(Buffer.compare(back.bytes, original)).toBe(0);
    expect(back.sha256).toBe(originalSha);
    const m = await getMemory(a, legacyId, memoryId);
    expect(m.media[0]).toMatchObject({ provenance: "P1_original_recording", originalFilename: "passwd", capture: "browser_recording" });

    const { zip, manifest } = await exportLegacy(a, legacyId);
    const dir = mkdtempSync(join(tmpdir(), "echo-export-"));
    writeFileSync(join(dir, "export.zip"), zip);
    execFileSync("unzip", ["-q", "export.zip"], { cwd: dir });
    const exported = readFileSync(join(dir, "echo-of-me-export", "originals", `${added.assetId}.wav`));
    expect(sha(exported)).toBe(originalSha);
    expect(Buffer.compare(exported, original)).toBe(0);
    // The export's own checksum file verifies with the standard tool.
    expect(execFileSync("sha256sum", ["-c", "SHA256SUMS"], { cwd: join(dir, "echo-of-me-export") }).toString()).toContain(": OK");
    expect(manifest.files).toHaveLength(1);
  });

  it("detects a changed or missing original instead of serving it", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Tamper" });
    const { assetId } = await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" });
    const path = join(blobDir(), legacyId, assetId);
    const bytes = readFileSync(path);
    bytes[100] ^= 0xff;
    writeFileSync(path, bytes);
    await expect(readMedia(a, assetId)).rejects.toBeInstanceOf(IntegrityError);
    await expect(exportLegacy(a, legacyId)).rejects.toBeInstanceOf(IntegrityError);
    expect(await actions(a.accountId)).toContainEqual({ action: "media.integrity_failure", outcome: "error" });
  });

  it("adding or removing a recording returns an approved item to draft", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Song", body: "My song for you.", approve: true });
    const { assetId } = await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" });
    expect((await getMemory(a, legacyId, memoryId)).approval).toBe("draft");
    await setMemoryApproval(a, legacyId, memoryId, true, 1);
    expect((await citableSources(a, legacyId)).map((s) => s.sourceType).sort()).toEqual(["media_asset", "memory_version"]);
    await deleteMedia(a, legacyId, assetId);
    expect((await getMemory(a, legacyId, memoryId)).approval).toBe("draft");
    expect(await rawSystem(pool(), "select 1 from media_asset where id = $1", [assetId])).toHaveLength(0);
  });

  it("a recording alone can be approved", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Just my voice" });
    await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "browser_recording" });
    await setMemoryApproval(a, legacyId, memoryId, true, 1);
    expect((await citableSources(a, legacyId)).map((s) => s.provenance).sort()).toEqual(["P1_original_recording", "P2_author_written"]);
  });
});

describe("Transcripts and suggestions are never citable until approved (AC-04)", () => {
  it("a machine transcript is P6 and invisible to retrieval; approval makes it P3; a new version is unapproved again", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Advice on exams", body: "Short note." });
    const { assetId } = await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" });
    await recordMachineTranscript(a, legacyId, assetId, "Machine heard: study a little every day.");
    await setMemoryApproval(a, legacyId, memoryId, true, 1); // the item is approved, the transcript is not

    let m = await getMemory(a, legacyId, memoryId);
    expect(m.media[0].transcript).toMatchObject({ origin: "machine", approval: "draft", provenance: "P6_unapproved_machine_output" });
    let cited = await citableSources(a, legacyId);
    expect(cited.some((c) => c.sourceType === "transcript_version")).toBe(false);
    expect(cited.some((c) => (c.text ?? "").includes("Machine heard"))).toBe(false);

    await setTranscriptApproval(a, legacyId, assetId, true, 1);
    cited = await citableSources(a, legacyId);
    expect(cited.find((c) => c.sourceType === "transcript_version")).toMatchObject({ provenance: "P3_approved_transcript", text: "Machine heard: study a little every day." });

    await saveTranscript(a, legacyId, assetId, { text: "Study a little every day, and sleep.", expectedVersion: 1 });
    cited = await citableSources(a, legacyId);
    expect(cited.some((c) => c.sourceType === "transcript_version")).toBe(false);
    m = await getMemory(a, legacyId, memoryId);
    expect(m.media[0].transcript!.versions.map((v) => [v.versionNo, v.origin])).toEqual([[2, "author_typed"], [1, "machine"]]);
    expect(m.media[0].transcript!.provenance).toBe("P6_unapproved_machine_output");
  });

  it("an approved transcript is not citable while its item is a draft", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Draft item" });
    const { assetId } = await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" });
    await saveTranscript(a, legacyId, assetId, { text: "Typed by me.", expectedVersion: 0, approve: true });
    expect(await citableSources(a, legacyId)).toHaveLength(0);
  });

  it("machine transcripts and suggestions need the AI-processing consent", async () => {
    const { a, legacyId } = await author(["terms_of_service", "privacy_notice", "audio_recording"]);
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "x", body: "My father taught me to save money." });
    const { assetId } = await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" });
    await expect(recordMachineTranscript(a, legacyId, assetId, "text")).rejects.toBeInstanceOf(ConsentRequiredError);
    await expect(suggestTags(a, legacyId, memoryId)).rejects.toBeInstanceOf(ConsentRequiredError);
  });

  it("suggested tags wait for the author; rejected ones are not suggested again; withdrawal removes pending ones", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, {
      kind: "memory",
      title: "What my father taught me",
      body: "My father taught me to save money and to be honest at work, even when it was difficult.",
    });
    const { suggested } = await suggestTags(a, legacyId, memoryId);
    expect(suggested).toEqual(expect.arrayContaining(["family", "money", "honesty", "work"]));
    let tags = (await getMemory(a, legacyId, memoryId)).tags;
    expect(tags.every((t) => t.origin === "automatic" && t.state === "suggested")).toBe(true);

    const money = tags.find((t) => t.label === "money")!;
    const work = tags.find((t) => t.label === "work")!;
    await decideTag(a, legacyId, money.id, "approved");
    await decideTag(a, legacyId, work.id, "rejected");
    expect((await suggestTags(a, legacyId, memoryId)).suggested).toEqual([]);
    await addTag(a, legacyId, memoryId, { kind: "person", label: "Grandpa Joe" });

    await withdrawConsent(a, "ai_processing");
    tags = (await getMemory(a, legacyId, memoryId)).tags;
    expect(tags.map((t) => `${t.label}:${t.state}`).sort()).toEqual(["Grandpa Joe:approved", "money:approved", "work:rejected"]);
    expect((await actions(a.accountId)).map((x) => x.action)).toContain("tag.withdraw_suggestions");
  });

  it("keyword rules are deterministic and whole-word only", () => {
    expect(suggestThemes("Dad said: never give up!")).toEqual(["family", "resilience"]);
    expect(suggestThemes("A workshop about savings accounts")).toEqual(["money"]); // "workshop" is not "work"
    expect(suggestThemes("")).toEqual([]);
  });
});

describe("History is append-only in the database itself", () => {
  it("versions and originals cannot be altered, and versions cannot be deleted one by one", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "T", body: "B" });
    const { assetId } = await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" });
    await saveTranscript(a, legacyId, assetId, { text: "words", expectedVersion: 0 });
    await expect(rawAs(pool(), a.accountId, "update memory_version set body = 'rewritten' where memory_id = $1", [memoryId])).rejects.toThrow(/permission denied/);
    await expect(rawAs(pool(), a.accountId, "delete from memory_version where memory_id = $1", [memoryId])).rejects.toThrow(/permission denied/);
    await expect(rawAs(pool(), a.accountId, "update transcript_version set text = 'x' where media_asset_id = $1", [assetId])).rejects.toThrow(/permission denied/);
    await expect(rawAs(pool(), a.accountId, "update media_asset set sha256 = repeat('0', 64) where id = $1", [assetId])).rejects.toThrow(/permission denied/);
    // Even the database owner cannot rewrite them (trigger).
    await expect(rawSystem(pool(), "update memory_version set body = 'x' where memory_id = $1", [memoryId])).rejects.toThrow(/immutable/);
    await expect(rawSystem(pool(), "update media_asset set original_filename = 'x' where id = $1", [assetId])).rejects.toThrow(/immutable/);
  });
});

describe("Deletion and export", () => {
  it("deleting needs a second factor, removes every version and original, and keeps the audit trail", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Delete me", body: "v1" });
    await editMemory(a, legacyId, memoryId, { expectedVersion: 1, title: "Delete me", body: "v2" });
    const { assetId } = await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" });
    await saveTranscript(a, legacyId, assetId, { text: "t", expectedVersion: 0 });
    await addTag(a, legacyId, memoryId, { kind: "theme", label: "family" });

    await expect(deleteMemory({ accountId: a.accountId, aal: "aal1" }, legacyId, memoryId)).rejects.toBeInstanceOf(MfaRequiredError);
    expect(await deleteMemory(a, legacyId, memoryId)).toEqual({ deletedMedia: 1 });
    for (const t of ["memory_item", "memory_version", "media_asset", "transcript", "transcript_version", "memory_tag"]) {
      expect(await rawSystem(pool(), `select 1 from ${t} where legacy_id = $1`, [legacyId])).toHaveLength(0);
    }
    expect(() => readFileSync(join(blobDir(), legacyId, assetId))).toThrow(/ENOENT/);
    await expect(readMedia(a, assetId)).rejects.toBeInstanceOf(NotFoundError);
    const log = await actions(a.accountId);
    expect(log).toContainEqual({ action: "memory.delete", outcome: "success" });
    expect(log).toContainEqual({ action: "memory.delete", outcome: "denied" });
  });

  it("export needs a second factor and contains every version, provenance class and decision", async () => {
    const { a, legacyId } = await author();
    await expect(exportLegacy({ accountId: a.accountId, aal: "aal1" }, legacyId)).rejects.toBeInstanceOf(MfaRequiredError);
    const { memoryId } = await createMemory(a, legacyId, { kind: "value_statement", title: "Kindness", body: "Be kind first.", approve: true });
    await editMemory(a, legacyId, memoryId, { expectedVersion: 1, title: "Kindness", body: "Be kind first, always." });
    const { assetId } = await addMedia(a, legacyId, memoryId, { bytes: PNG_1PX, capture: "upload" });
    await suggestTags(a, legacyId, memoryId);

    const { manifest, zip, filename } = await exportLegacy(a, legacyId);
    expect(filename).toMatch(/^echo-of-me-export-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(manifest.format).toBe("echo-of-me-export/0.1");
    const mem = manifest.memories[0] as Record<string, any>;
    expect(mem.versions.map((v: any) => v.body)).toEqual(["Be kind first.", "Be kind first, always."]);
    expect(mem.versions.every((v: any) => v.provenance === "P2_author_written")).toBe(true);
    expect(mem.approval).toBe("draft");
    expect(mem.media[0]).toMatchObject({ id: assetId, provenance: "P1_original_recording", file: `originals/${assetId}.png` });
    expect(mem.tags[0]).toMatchObject({ label: "kindness", provenance: "P6_unapproved_machine_output" });
    expect(manifest.consents.length).toBeGreaterThan(0);
    expect(manifest.activity_log.some((e: any) => e.action === "memory.create")).toBe(true);
    // Valid archive according to an independent implementation.
    const dir = mkdtempSync(join(tmpdir(), "echo-export-"));
    writeFileSync(join(dir, "e.zip"), zip);
    expect(execFileSync("python3", ["-I", "-c", "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print(z.testzip())", join(dir, "e.zip")]).toString().trim()).toBe("None");
    expect((await actions(a.accountId))).toContainEqual({ action: "legacy.export", outcome: "success" });
  });

  it("the zip writer produces archives that standard tools accept, including UTF-8 names", () => {
    const zip = buildZip([
      { name: "a/hello.txt", data: Buffer.from("hello") },
      { name: "a/ñandú.bin", data: Buffer.from([0, 1, 2, 255]) },
    ]);
    const dir = mkdtempSync(join(tmpdir(), "echo-zip-"));
    writeFileSync(join(dir, "t.zip"), zip);
    expect(execFileSync("unzip", ["-t", "t.zip"], { cwd: dir }).toString()).toContain("No errors detected");
    expect(() => buildZip([{ name: "../evil", data: Buffer.alloc(1) }])).toThrow();
  });
});

describe("Errors do not leak", () => {
  it("unknown ids look the same as someone else's", async () => {
    const { a, legacyId } = await author();
    await expect(getMemory(a, legacyId, "00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getMemory(a, legacyId, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
    await expect(readMedia(a, "' or 1=1 --")).rejects.toBeInstanceOf(NotFoundError);
    await expect(setAudience(a, legacyId, "00000000-0000-0000-0000-000000000000", [])).rejects.toBeInstanceOf(NotFoundError);
    await expect(createMemory(a, legacyId, { kind: "memory", title: "" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createMemory(a, legacyId, { kind: "bogus" as never, title: "x" })).rejects.toBeInstanceOf(ValidationError);
    expect(PolicyError).toBeDefined();
  });
});
