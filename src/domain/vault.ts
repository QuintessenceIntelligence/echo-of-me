import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withActor, type Queryable } from "../server/db";
import { getBlobStore, sha256Hex, type BlobStore } from "../server/storage";
import { audit, guarded } from "./audit";
import { requireMfa, type AuthContext } from "./auth";
import { assertConsents } from "./consent";
import { DomainError, NotFoundError, PolicyError, ValidationError } from "./errors";
import { kindOf, MAX_BYTES, sniffMime, type AllowedMime } from "./media-type";
import { ownedLegacy, parse } from "./onboarding";
import { suggestThemes } from "./suggest";
import { enforceLimit } from "./limits";

/**
 * Module 02, Memory & Wisdom Vault: capture and provenance (vertical slice 2, ADR-006).
 *
 * Provenance classes (01B §4.3):
 *   P1 original recording · P2 author-written · P3 approved transcript · P4 approved derivation (AI, later)
 *   P5 contributor-authored (post-MVP) · P6 unapproved machine output (never citable).
 * An item is citable only while it is approved, and approval always refers to the exact current version:
 * any change to the words or recordings returns the item to draft (AC-04, AC-05).
 */

export type Provenance =
  | "P1_original_recording"
  | "P2_author_written"
  | "P3_approved_transcript"
  | "P4_approved_derivation"
  | "P5_contributor_authored"
  | "P6_unapproved_machine_output";

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  P1_original_recording: "Original recording",
  P2_author_written: "In your own words",
  P3_approved_transcript: "Transcript you approved",
  P4_approved_derivation: "Summary you approved",
  P5_contributor_authored: "Written by a family member",
  P6_unapproved_machine_output: "Unapproved, never used in answers",
};

export const MAX_LEGACY_MEDIA_BYTES = 250 * 1024 * 1024;
const CAPTURE_STATES = new Set(["draft", "active"]);
const UUID = z.uuid();

export class IntegrityError extends DomainError {
  constructor() {
    super("integrity", "This recording could not be verified against its original fingerprint, so it was not shown.");
  }
}

const stale = () => new PolicyError("stale_version", "This was changed in another window. Please reload the page and try again.");

// ------------------------------------------------------------------ helpers

async function capturableLegacy(db: Queryable, ctx: AuthContext, legacyId: string) {
  const l = await ownedLegacy(db, ctx, legacyId);
  if (!CAPTURE_STATES.has(l.state)) throw new PolicyError("legacy_locked", "This legacy is not open for changes.");
  return l;
}

interface ItemRow {
  id: string;
  legacy_id: string;
  kind: "memory" | "value_statement";
  current_version: number;
  approval: "draft" | "approved";
}

async function ownedItem(db: Queryable, legacyId: string, memoryId: string, lock = false): Promise<ItemRow> {
  if (!UUID.safeParse(memoryId).success) throw new NotFoundError("memory");
  const { rows } = await db.query(
    `select id, legacy_id, kind, current_version, approval from memory_item
      where id = $1 and legacy_id = $2 ${lock ? "for update" : ""}`,
    [memoryId, legacyId],
  );
  if (!rows[0]) throw new NotFoundError("memory");
  return rows[0] as ItemRow;
}

async function currentText(db: Queryable, item: ItemRow) {
  const { rows } = await db.query(
    "select title, body, occurred_label from memory_version where memory_id = $1 and version_no = $2",
    [item.id, item.current_version],
  );
  return rows[0] as { title: string; body: string; occurred_label: string | null };
}

async function hasMedia(db: Queryable, memoryId: string): Promise<boolean> {
  return ((await db.query("select 1 from media_asset where memory_id = $1 limit 1", [memoryId])).rowCount ?? 0) > 0;
}

/** Returns an approved item to draft (used whenever its content changes). */
async function resetToDraft(db: Queryable, ctx: AuthContext, item: ItemRow, reason: string) {
  if (item.approval !== "approved") return;
  await db.query("update memory_item set approval = 'draft', approved_version = null, approved_at = null where id = $1", [item.id]);
  await audit(db, ctx, { action: "memory.unapprove", legacyId: item.legacy_id, targetType: "memory", targetId: item.id, detail: { reason } });
}

const normaliseText = (s: string) => s.replace(/\r\n?/g, "\n");

// ------------------------------------------------------------------ memories and value statements

const MemoryInput = z.object({
  kind: z.enum(["memory", "value_statement"], "Please choose what you are adding."),
  title: z.string().trim().min(1, "Please give this a title.").max(160, "Please keep the title under 160 characters."),
  body: z.string().max(20000, "Please keep this under 20,000 characters.").optional().default("").transform(normaliseText),
  occurredLabel: z.string().trim().max(80, "Please keep this under 80 characters.").optional().transform((v) => v || null),
  sensitivity: z.enum(["standard", "sensitive"]).optional().default("standard"),
  approve: z.boolean().optional().default(false),
  /** The guided prompt this item answers (module 05), if any. */
  promptId: z.string().regex(/^[a-z_]+-[0-9]{2}$/).optional().or(z.literal("").transform(() => undefined)),
});

export async function createMemory(
  ctx: AuthContext,
  legacyId: string,
  input: z.input<typeof MemoryInput>,
): Promise<{ memoryId: string }> {
  const p = parseMemoryInput(input);
  return guarded(ctx, "memory.create", { legacyId }, (db) => insertMemoryTx(db, ctx, legacyId, p));
}

export type MemoryInputParsed = z.output<typeof MemoryInput>;

export function parseMemoryInput(input: z.input<typeof MemoryInput>): MemoryInputParsed {
  const p = parse(MemoryInput, input);
  if (p.approve && !p.body.trim()) {
    throw new ValidationError("Add some words before approving, or save it as a draft and add a recording.", { body: "Empty." });
  }
  return p;
}

/** Creates an item and its first version inside the caller's transaction (used by rehearsal corrections too). */
export async function insertMemoryTx(db: Queryable, ctx: AuthContext, legacyId: string, p: MemoryInputParsed): Promise<{ memoryId: string }> {
  await capturableLegacy(db, ctx, legacyId);
  if (p.promptId && !(await db.query("select 1 from prompt where id = $1 and retired_in is null", [p.promptId])).rowCount) {
    throw new ValidationError("That prompt is no longer available.");
  }
  const memoryId = randomUUID();
  await db.query(
    `insert into memory_item (id, legacy_id, kind, sensitivity, created_by, approval, approved_version, approved_at, prompt_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [memoryId, legacyId, p.kind, p.sensitivity, ctx.accountId, p.approve ? "approved" : "draft", p.approve ? 1 : null, p.approve ? new Date() : null, p.promptId ?? null],
  );
  await db.query(
    `insert into memory_version (memory_id, legacy_id, version_no, title, body, occurred_label, created_by)
     values ($1, $2, 1, $3, $4, $5, $6)`,
    [memoryId, legacyId, p.title, p.body, p.occurredLabel, ctx.accountId],
  );
  await audit(db, ctx, { action: "memory.create", legacyId, targetType: "memory", targetId: memoryId, detail: { kind: p.kind, version: 1, prompt: p.promptId ?? null } });
  if (p.approve) await audit(db, ctx, { action: "memory.approve", legacyId, targetType: "memory", targetId: memoryId, detail: { version: 1 } });
  return { memoryId };
}

const EditInput = z.object({
  expectedVersion: z.number().int().min(1),
  title: z.string().trim().min(1, "Please give this a title.").max(160),
  body: z.string().max(20000, "Please keep this under 20,000 characters.").transform(normaliseText),
  occurredLabel: z.string().trim().max(80).optional().transform((v) => v || null),
  approve: z.boolean().optional().default(false),
});

/**
 * Saves a new version. The earlier versions are kept unchanged. A changed text returns the item to draft
 * unless the author approves the new wording in the same step.
 */
export async function editMemory(
  ctx: AuthContext,
  legacyId: string,
  memoryId: string,
  input: z.input<typeof EditInput>,
): Promise<{ version: number; changed: boolean }> {
  const p = parse(EditInput, input);
  return guarded(ctx, "memory.edit", { legacyId, targetType: "memory", targetId: memoryId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    const item = await ownedItem(db, legacyId, memoryId, true);
    if (item.current_version !== p.expectedVersion) throw stale();
    const cur = await currentText(db, item);
    const changed = cur.title !== p.title || cur.body !== p.body || (cur.occurred_label ?? null) !== p.occurredLabel;
    let version = item.current_version;
    if (changed) {
      version += 1;
      await db.query(
        `insert into memory_version (memory_id, legacy_id, version_no, title, body, occurred_label, created_by)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [memoryId, legacyId, version, p.title, p.body, p.occurredLabel, ctx.accountId],
      );
      await resetToDraft(db, ctx, item, "edited");
      await db.query("update memory_item set current_version = $2 where id = $1", [memoryId, version]);
      await audit(db, ctx, { action: "memory.edit", legacyId, targetType: "memory", targetId: memoryId, detail: { version } });
    }
    if (p.approve && (changed || item.approval !== "approved")) {
      await approveInTx(db, ctx, { ...item, current_version: version, approval: "draft" }, p.body);
    }
    return { version, changed };
  });
}

async function approveInTx(db: Queryable, ctx: AuthContext, item: ItemRow, body?: string) {
  const text = body ?? (await currentText(db, item)).body;
  if (!text.trim() && !(await hasMedia(db, item.id))) {
    throw new ValidationError("There is nothing to approve yet. Add some words or a recording first.");
  }
  await db.query(
    "update memory_item set approval = 'approved', approved_version = current_version, approved_at = now() where id = $1",
    [item.id],
  );
  await audit(db, ctx, { action: "memory.approve", legacyId: item.legacy_id, targetType: "memory", targetId: item.id, detail: { version: item.current_version } });
}

/** Approve (or withdraw approval of) exactly the version the author was looking at. */
export async function setMemoryApproval(
  ctx: AuthContext,
  legacyId: string,
  memoryId: string,
  approve: boolean,
  expectedVersion: number,
): Promise<void> {
  await guarded(ctx, approve ? "memory.approve" : "memory.unapprove", { legacyId, targetType: "memory", targetId: memoryId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    const item = await ownedItem(db, legacyId, memoryId, true);
    if (item.current_version !== expectedVersion) throw stale();
    if (approve && item.approval !== "approved") await approveInTx(db, ctx, item);
    if (!approve) await resetToDraft(db, ctx, item, "author_withdrew");
  });
}

export async function setSensitivity(ctx: AuthContext, legacyId: string, memoryId: string, level: "standard" | "sensitive"): Promise<void> {
  if (level !== "standard" && level !== "sensitive") throw new ValidationError("Unknown sensitivity.");
  await guarded(ctx, "memory.sensitivity", { legacyId, targetType: "memory", targetId: memoryId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    await ownedItem(db, legacyId, memoryId, true);
    await db.query("update memory_item set sensitivity = $2 where id = $1", [memoryId, level]);
    await audit(db, ctx, { action: "memory.sensitivity", legacyId, targetType: "memory", targetId: memoryId, detail: { level } });
  });
}

/**
 * Records who the author intends this item for. This grants nobody access: recipients can read nothing
 * until the sharing slice (5) exists and the author explicitly shares (AC-02).
 */
export async function setAudience(ctx: AuthContext, legacyId: string, memoryId: string, recipientIds: string[]): Promise<void> {
  const ids = [...new Set(recipientIds)];
  if (ids.length > 200 || ids.some((id) => !UUID.safeParse(id).success)) throw new NotFoundError("recipient");
  await guarded(ctx, "memory.audience", { legacyId, targetType: "memory", targetId: memoryId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    await ownedItem(db, legacyId, memoryId, true);
    if (ids.length) {
      const found = await db.query("select id from recipient where legacy_id = $1 and id = any($2::uuid[])", [legacyId, ids]);
      if (found.rowCount !== ids.length) throw new NotFoundError("recipient");
    }
    await db.query("delete from memory_audience where memory_id = $1", [memoryId]);
    for (const rid of ids) {
      await db.query("insert into memory_audience (memory_id, recipient_id, legacy_id) values ($1, $2, $3)", [memoryId, rid, legacyId]);
    }
    await db.query("update memory_item set audience = $2 where id = $1", [memoryId, ids.length ? "selected" : "only_me"]);
    await audit(db, ctx, { action: "memory.audience", legacyId, targetType: "memory", targetId: memoryId, detail: { recipients: ids.length } });
  });
}

/** Permanent deletion of an item, all its versions, recordings, transcripts and tags. Needs MFA. */
export async function deleteMemory(ctx: AuthContext, legacyId: string, memoryId: string): Promise<{ deletedMedia: number }> {
  const store = getBlobStore(); // fail before deleting anything if file storage is unavailable
  const keys = await guarded(ctx, "memory.delete", { legacyId, targetType: "memory", targetId: memoryId }, async (db) => {
    requireMfa(ctx);
    await ownedLegacy(db, ctx, legacyId);
    await ownedItem(db, legacyId, memoryId, true);
    const media = (await db.query("select storage_key from media_asset where memory_id = $1", [memoryId])).rows.map((r) => r.storage_key as string);
    await db.query("delete from memory_item where id = $1 and legacy_id = $2", [memoryId, legacyId]);
    await audit(db, ctx, { action: "memory.delete", legacyId, targetType: "memory", targetId: memoryId, detail: { media: media.length } });
    return media;
  });
  await removeBlobs(store, keys);
  return { deletedMedia: keys.length };
}

async function removeBlobs(store: BlobStore, keys: string[]) {
  for (const k of keys) {
    // The database rows are already gone; a failure here leaves an unreachable file, never visible data.
    await store.delete(k).catch((err) => console.error("blob delete failed", k, err));
  }
}

// ------------------------------------------------------------------ original media (P1)

export interface AddMediaInput {
  bytes: Buffer;
  filename?: string | null;
  capture: "upload" | "browser_recording";
}

function safeFilename(name: string | null | undefined): string | null {
  if (!name) return null;
  const base = name.split(/[\\/]/).pop()!.replace(/[^\p{L}\p{N}._ -]+/gu, "_").slice(0, 200).trim();
  return base || null;
}

/**
 * Stores an original recording or still image exactly as received (P1). Audio needs the
 * "Storing your voice recordings" consent. The file type is decided from its bytes, not its name.
 * Adding a recording changes what the item contains, so an approved item returns to draft.
 */
export async function addMedia(
  ctx: AuthContext,
  legacyId: string,
  memoryId: string,
  input: AddMediaInput,
): Promise<{ assetId: string; mimeType: AllowedMime; sha256: string; byteSize: number }> {
  if (!Buffer.isBuffer(input.bytes) || input.bytes.length === 0) throw new ValidationError("The file is empty.");
  await enforceLimit(ctx, "upload", legacyId);
  if (input.capture !== "upload" && input.capture !== "browser_recording") throw new ValidationError("Unknown capture method.");
  const mime = sniffMime(input.bytes);
  if (!mime) {
    throw new ValidationError("This file type is not supported. Please use an audio file (WebM, Ogg, MP3, WAV, M4A) or a photo (PNG, JPEG, WebP).");
  }
  const kind = kindOf(mime);
  if (input.bytes.length > MAX_BYTES[kind]) {
    throw new ValidationError(`This file is too large. The limit is ${MAX_BYTES[kind] / 1024 / 1024} MB for ${kind === "audio" ? "recordings" : "photos"}.`);
  }
  if (input.capture === "browser_recording" && kind !== "audio") throw new ValidationError("A recording must be audio.");

  const assetId = randomUUID();
  const key = `${legacyId}/${assetId}`;
  const store = getBlobStore();
  try {
    return await guarded(ctx, "media.add", { legacyId, targetType: "memory", targetId: memoryId }, async (db) => {
      await capturableLegacy(db, ctx, legacyId);
      if (kind === "audio") await assertConsents(db, ctx, ["audio_recording"]);
      const item = await ownedItem(db, legacyId, memoryId, true);
      const used = Number((await db.query("select coalesce(sum(byte_size), 0) as n from media_asset where legacy_id = $1", [legacyId])).rows[0].n);
      if (used + input.bytes.length > MAX_LEGACY_MEDIA_BYTES) {
        throw new PolicyError("storage_full", "This legacy has reached its storage limit for the test version.");
      }
      const sha256 = sha256Hex(input.bytes);
      await store.put(key, input.bytes);
      // Read back and compare, so a storage fault is caught now rather than when someone needs the file.
      if (sha256Hex(await store.get(key)) !== sha256) throw new IntegrityError();
      await db.query(
        `insert into media_asset (id, legacy_id, memory_id, kind, mime_type, byte_size, sha256, storage_key, original_filename, capture, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [assetId, legacyId, memoryId, kind, mime, input.bytes.length, sha256, key, safeFilename(input.filename), input.capture, ctx.accountId],
      );
      await resetToDraft(db, ctx, item, "media_added");
      await audit(db, ctx, {
        action: "media.add",
        legacyId,
        targetType: "media",
        targetId: assetId,
        detail: { memory: memoryId, kind, mime, bytes: input.bytes.length, capture: input.capture },
      });
      return { assetId, mimeType: mime, sha256, byteSize: input.bytes.length };
    });
  } catch (err) {
    await store.delete(key).catch(() => undefined);
    throw err;
  }
}

/** Returns the original bytes after checking them against the stored SHA-256 and size (AC-03). */
export async function readMedia(
  ctx: AuthContext,
  assetId: string,
): Promise<{ bytes: Buffer; mimeType: AllowedMime; sha256: string; filename: string | null; legacyId: string }> {
  if (!UUID.safeParse(assetId).success) throw new NotFoundError("recording");
  const row = await withActor(ctx.accountId, async (db) => {
    const { rows } = await db.query(
      "select legacy_id, mime_type, sha256, byte_size, storage_key, original_filename from media_asset where id = $1",
      [assetId],
    );
    return rows[0];
  });
  if (!row) throw new NotFoundError("recording");
  let bytes: Buffer;
  try {
    bytes = await getBlobStore().get(row.storage_key);
  } catch {
    bytes = Buffer.alloc(0);
  }
  if (bytes.length !== Number(row.byte_size) || sha256Hex(bytes) !== row.sha256) {
    await withActor(ctx.accountId, (db) =>
      audit(db, ctx, { action: "media.integrity_failure", legacyId: row.legacy_id, targetType: "media", targetId: assetId, outcome: "error" }),
    ).catch(() => undefined);
    throw new IntegrityError();
  }
  // A recipient playing a shared original is access to the author's content: logged for the author (AC-13).
  await withActor(ctx.accountId, async (db) => {
    const owner = (await db.query("select app.owns_legacy($1) as ok", [row.legacy_id])).rows[0].ok as boolean;
    if (!owner) await audit(db, ctx, { action: "shared.media_play", legacyId: row.legacy_id, targetType: "media", targetId: assetId });
  });
  return { bytes, mimeType: row.mime_type, sha256: row.sha256, filename: row.original_filename, legacyId: row.legacy_id };
}

export async function deleteMedia(ctx: AuthContext, legacyId: string, assetId: string): Promise<void> {
  if (!UUID.safeParse(assetId).success) throw new NotFoundError("recording");
  const store = getBlobStore();
  const key = await guarded(ctx, "media.delete", { legacyId, targetType: "media", targetId: assetId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    const { rows } = await db.query("select storage_key, memory_id from media_asset where id = $1 and legacy_id = $2", [assetId, legacyId]);
    if (!rows[0]) throw new NotFoundError("recording");
    const item = await ownedItem(db, legacyId, rows[0].memory_id, true);
    await db.query("delete from media_asset where id = $1", [assetId]);
    // Removing a recording changes what an approved item contains: the author re-approves it.
    await resetToDraft(db, ctx, item, "media_removed");
    await audit(db, ctx, { action: "media.delete", legacyId, targetType: "media", targetId: assetId, detail: { memory: item.id } });
    return rows[0].storage_key as string;
  });
  await removeBlobs(store, [key]);
}

// ------------------------------------------------------------------ transcripts (P6 → P3)

async function ownedAudio(db: Queryable, legacyId: string, assetId: string) {
  if (!UUID.safeParse(assetId).success) throw new NotFoundError("recording");
  const { rows } = await db.query(
    "select id, memory_id, kind from media_asset where id = $1 and legacy_id = $2",
    [assetId, legacyId],
  );
  if (!rows[0]) throw new NotFoundError("recording");
  if (rows[0].kind !== "audio") throw new ValidationError("Only recordings have transcripts.");
  return rows[0] as { id: string; memory_id: string };
}

async function addTranscriptVersion(
  db: Queryable,
  legacyId: string,
  assetId: string,
  text: string,
  origin: "author_typed" | "machine",
  createdBy: string | null,
  expectedVersion: number,
): Promise<number> {
  const t = (await db.query("select current_version from transcript where media_asset_id = $1 for update", [assetId])).rows[0];
  const current = t ? (t.current_version as number) : 0;
  if (current !== expectedVersion) throw stale();
  const version = current + 1;
  if (!t) {
    await db.query(
      "insert into transcript (media_asset_id, legacy_id, current_version) values ($1, $2, 1)",
      [assetId, legacyId],
    );
  } else {
    // A new version is unapproved until the author approves it (P6).
    await db.query("update transcript set current_version = $2, approval = 'draft', approved_at = null where media_asset_id = $1", [assetId, version]);
  }
  await db.query(
    `insert into transcript_version (media_asset_id, legacy_id, version_no, text, origin, created_by)
     values ($1, $2, $3, $4, $5, $6)`,
    [assetId, legacyId, version, text, origin, createdBy],
  );
  return version;
}

const TranscriptInput = z.object({
  text: z.string().transform(normaliseText).pipe(z.string().trim().min(1, "The transcript is empty.").max(100000)),
  expectedVersion: z.number().int().min(0),
  approve: z.boolean().optional().default(false),
});

/** The author types or corrects a transcript. The original recording is never changed. */
export async function saveTranscript(
  ctx: AuthContext,
  legacyId: string,
  assetId: string,
  input: z.input<typeof TranscriptInput>,
): Promise<{ version: number }> {
  const p = parse(TranscriptInput, input);
  return guarded(ctx, "transcript.save", { legacyId, targetType: "media", targetId: assetId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    await ownedAudio(db, legacyId, assetId);
    const version = await addTranscriptVersion(db, legacyId, assetId, p.text, "author_typed", ctx.accountId, p.expectedVersion);
    await audit(db, ctx, { action: "transcript.save", legacyId, targetType: "media", targetId: assetId, detail: { version, origin: "author_typed" } });
    if (p.approve) await approveTranscriptInTx(db, ctx, legacyId, assetId, version);
    return { version };
  });
}

/**
 * Entry point for a future transcription provider (ADR-007, not chosen; R0 budget). Machine output is
 * always stored unapproved (P6) and needs the AI-processing consent. Not exposed in the interface yet.
 */
export async function recordMachineTranscript(ctx: AuthContext, legacyId: string, assetId: string, text: string): Promise<{ version: number }> {
  const clean = normaliseText(String(text ?? "")).trim();
  if (!clean || clean.length > 100000) throw new ValidationError("The transcript is empty.");
  return guarded(ctx, "transcript.machine", { legacyId, targetType: "media", targetId: assetId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    await assertConsents(db, ctx, ["ai_processing"]);
    await ownedAudio(db, legacyId, assetId);
    const cur = (await db.query("select current_version from transcript where media_asset_id = $1", [assetId])).rows[0];
    const version = await addTranscriptVersion(db, legacyId, assetId, clean, "machine", null, cur ? cur.current_version : 0);
    await audit(db, ctx, { action: "transcript.save", legacyId, targetType: "media", targetId: assetId, detail: { version, origin: "machine" } });
    return { version };
  });
}

async function approveTranscriptInTx(db: Queryable, ctx: AuthContext, legacyId: string, assetId: string, version: number) {
  await db.query("update transcript set approval = 'approved', approved_at = now() where media_asset_id = $1 and current_version = $2", [assetId, version]);
  await audit(db, ctx, { action: "transcript.approve", legacyId, targetType: "media", targetId: assetId, detail: { version } });
}

export async function setTranscriptApproval(
  ctx: AuthContext,
  legacyId: string,
  assetId: string,
  approve: boolean,
  expectedVersion: number,
): Promise<void> {
  await guarded(ctx, approve ? "transcript.approve" : "transcript.unapprove", { legacyId, targetType: "media", targetId: assetId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    await ownedAudio(db, legacyId, assetId);
    const t = (await db.query("select current_version, approval from transcript where media_asset_id = $1 for update", [assetId])).rows[0];
    if (!t) throw new NotFoundError("transcript");
    if (t.current_version !== expectedVersion) throw stale();
    if (approve && t.approval !== "approved") await approveTranscriptInTx(db, ctx, legacyId, assetId, expectedVersion);
    if (!approve && t.approval === "approved") {
      await db.query("update transcript set approval = 'draft', approved_at = null where media_asset_id = $1", [assetId]);
      await audit(db, ctx, { action: "transcript.unapprove", legacyId, targetType: "media", targetId: assetId, detail: { version: expectedVersion } });
    }
  });
}

// ------------------------------------------------------------------ tags

const TagInput = z.object({
  kind: z.enum(["theme", "person", "value"]),
  label: z.string().trim().min(1, "Please enter a tag.").max(60, "Please keep tags under 60 characters.").regex(/^[^\p{Cc}]+$/u),
});

export async function addTag(ctx: AuthContext, legacyId: string, memoryId: string, input: z.input<typeof TagInput>): Promise<{ tagId: string }> {
  const p = parse(TagInput, input);
  return guarded(ctx, "tag.add", { legacyId, targetType: "memory", targetId: memoryId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    await ownedItem(db, legacyId, memoryId);
    const existing = (await db.query(
      "select id, origin, state from memory_tag where memory_id = $1 and kind = $2 and lower(label) = lower($3)",
      [memoryId, p.kind, p.label],
    )).rows[0];
    if (existing) {
      // Typing a tag that was suggested (or rejected earlier) is an explicit author decision.
      if (existing.state !== "approved") {
        await db.query("update memory_tag set state = 'approved', decided_at = now() where id = $1", [existing.id]);
      }
      await audit(db, ctx, { action: "tag.add", legacyId, targetType: "tag", targetId: existing.id });
      return { tagId: existing.id as string };
    }
    const { rows } = await db.query(
      `insert into memory_tag (legacy_id, memory_id, kind, label, origin, state, decided_at)
       values ($1, $2, $3, $4, 'author', 'approved', now()) returning id`,
      [legacyId, memoryId, p.kind, p.label],
    );
    await audit(db, ctx, { action: "tag.add", legacyId, targetType: "tag", targetId: rows[0].id, detail: { kind: p.kind } });
    return { tagId: rows[0].id as string };
  });
}

export async function removeTag(ctx: AuthContext, legacyId: string, tagId: string): Promise<void> {
  if (!UUID.safeParse(tagId).success) throw new NotFoundError("tag");
  await guarded(ctx, "tag.remove", { legacyId, targetType: "tag", targetId: tagId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    const res = await db.query("delete from memory_tag where id = $1 and legacy_id = $2", [tagId, legacyId]);
    if (!res.rowCount) throw new NotFoundError("tag");
    await audit(db, ctx, { action: "tag.remove", legacyId, targetType: "tag", targetId: tagId });
  });
}

/**
 * Runs the local keyword rules over the item's words and transcripts and adds new theme suggestions
 * as unapproved (P6). Needs the AI-processing consent, because the consent text covers automatic
 * organisation and tagging. Themes the author already has or rejected are not suggested again.
 */
export async function suggestTags(ctx: AuthContext, legacyId: string, memoryId: string): Promise<{ suggested: string[] }> {
  return guarded(ctx, "tag.suggest", { legacyId, targetType: "memory", targetId: memoryId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    await assertConsents(db, ctx, ["ai_processing"]);
    const item = await ownedItem(db, legacyId, memoryId);
    const cur = await currentText(db, item);
    const transcripts = (await db.query(
      `select tv.text from transcript t join transcript_version tv on tv.media_asset_id = t.media_asset_id and tv.version_no = t.current_version
         join media_asset m on m.id = t.media_asset_id where m.memory_id = $1`,
      [memoryId],
    )).rows.map((r) => r.text as string);
    const themes = suggestThemes([cur.title, cur.body, ...transcripts].join("\n"));
    const suggested: string[] = [];
    for (const theme of themes) {
      const r = await db.query(
        `insert into memory_tag (legacy_id, memory_id, kind, label, origin, state)
         values ($1, $2, 'theme', $3, 'automatic', 'suggested')
         on conflict (memory_id, kind, lower(label)) do nothing returning id`,
        [legacyId, memoryId, theme],
      );
      if (r.rowCount) suggested.push(theme);
    }
    await audit(db, ctx, { action: "tag.suggest", legacyId, targetType: "memory", targetId: memoryId, detail: { suggested: suggested.length, method: "keyword_rules_v1" } });
    return { suggested };
  });
}

export async function decideTag(ctx: AuthContext, legacyId: string, tagId: string, decision: "approved" | "rejected"): Promise<void> {
  if (decision !== "approved" && decision !== "rejected") throw new ValidationError("Unknown decision.");
  if (!UUID.safeParse(tagId).success) throw new NotFoundError("tag");
  await guarded(ctx, decision === "approved" ? "tag.approve" : "tag.reject", { legacyId, targetType: "tag", targetId: tagId }, async (db) => {
    await capturableLegacy(db, ctx, legacyId);
    const res = await db.query(
      "update memory_tag set state = $3, decided_at = now() where id = $1 and legacy_id = $2 and origin = 'automatic' returning id",
      [tagId, legacyId, decision],
    );
    if (!res.rowCount) throw new NotFoundError("tag");
    await audit(db, ctx, { action: decision === "approved" ? "tag.approve" : "tag.reject", legacyId, targetType: "tag", targetId: tagId });
  });
}

// ------------------------------------------------------------------ read models

export interface MemorySummary {
  id: string;
  kind: "memory" | "value_statement";
  title: string;
  occurredLabel: string | null;
  approval: "draft" | "approved";
  sensitivity: "standard" | "sensitive";
  audience: "only_me" | "selected";
  currentVersion: number;
  mediaCount: number;
  pendingSuggestions: number;
  updatedAt: string;
}

export async function listMemories(ctx: AuthContext, legacyId: string): Promise<MemorySummary[]> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const { rows } = await db.query(
      `select i.id, i.kind, v.title, v.occurred_label, i.approval, i.sensitivity, i.audience, i.current_version, i.updated_at,
              (select count(*) from media_asset m where m.memory_id = i.id)::int as media_count,
              (select count(*) from memory_tag t where t.memory_id = i.id and t.state = 'suggested')::int as pending
         from memory_item i join memory_version v on v.memory_id = i.id and v.version_no = i.current_version
        where i.legacy_id = $1 order by i.updated_at desc, i.id`,
      [legacyId],
    );
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      occurredLabel: r.occurred_label,
      approval: r.approval,
      sensitivity: r.sensitivity,
      audience: r.audience,
      currentVersion: r.current_version,
      mediaCount: r.media_count,
      pendingSuggestions: r.pending,
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  });
}

export interface TranscriptView {
  currentVersion: number;
  approval: "draft" | "approved";
  approvedAt: string | null;
  text: string;
  origin: "author_typed" | "machine";
  provenance: Provenance;
  versions: { versionNo: number; text: string; origin: string; createdAt: string }[];
}

export interface MediaView {
  id: string;
  kind: "audio" | "image";
  mimeType: string;
  byteSize: number;
  sha256: string;
  originalFilename: string | null;
  capture: "upload" | "browser_recording";
  createdAt: string;
  provenance: Provenance;
  transcript: TranscriptView | null;
}

export interface MemoryDetail {
  id: string;
  legacyId: string;
  kind: "memory" | "value_statement";
  approval: "draft" | "approved";
  approvedAt: string | null;
  sensitivity: "standard" | "sensitive";
  audience: "only_me" | "selected";
  currentVersion: number;
  current: { title: string; body: string; occurredLabel: string | null; createdAt: string };
  textProvenance: Provenance;
  versions: { versionNo: number; title: string; body: string; occurredLabel: string | null; createdAt: string }[];
  media: MediaView[];
  tags: { id: string; kind: string; label: string; origin: "author" | "automatic"; state: "suggested" | "approved" | "rejected" }[];
  audienceRecipientIds: string[];
  recipients: { id: string; displayName: string; isMinor: boolean }[];
  /** True only when this item's material may be used in answers (slice 3): approved, current version. */
  citable: boolean;
  /** The guided prompt this item answers, if any (module 05). */
  prompt: { id: string; theme: string; text: string } | null;
}

export function transcriptProvenance(approval: "draft" | "approved"): Provenance {
  return approval === "approved" ? "P3_approved_transcript" : "P6_unapproved_machine_output";
}

export async function getMemory(ctx: AuthContext, legacyId: string, memoryId: string): Promise<MemoryDetail> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    if (!UUID.safeParse(memoryId).success) throw new NotFoundError("memory");
    const i = (await db.query(
      `select i.id, i.legacy_id, i.kind, i.approval, i.approved_at, i.sensitivity, i.audience, i.current_version,
              p.id as prompt_id, p.theme as prompt_theme, p.text as prompt_text
         from memory_item i left join prompt p on p.id = i.prompt_id
        where i.id = $1 and i.legacy_id = $2`,
      [memoryId, legacyId],
    )).rows[0];
    if (!i) throw new NotFoundError("memory");
    const versions = (await db.query(
      "select version_no, title, body, occurred_label, created_at from memory_version where memory_id = $1 order by version_no desc",
      [memoryId],
    )).rows.map((v) => ({ versionNo: v.version_no, title: v.title, body: v.body, occurredLabel: v.occurred_label, createdAt: new Date(v.created_at).toISOString() }));
    const cur = versions.find((v) => v.versionNo === i.current_version)!;
    const mediaRows = (await db.query(
      `select id, kind, mime_type, byte_size, sha256, original_filename, capture, created_at from media_asset where memory_id = $1 order by created_at`,
      [memoryId],
    )).rows;
    const media: MediaView[] = [];
    for (const m of mediaRows) {
      let transcript: TranscriptView | null = null;
      const t = (await db.query("select current_version, approval, approved_at from transcript where media_asset_id = $1", [m.id])).rows[0];
      if (t) {
        const tv = (await db.query(
          "select version_no, text, origin, created_at from transcript_version where media_asset_id = $1 order by version_no desc",
          [m.id],
        )).rows.map((v) => ({ versionNo: v.version_no, text: v.text, origin: v.origin, createdAt: new Date(v.created_at).toISOString() }));
        const c = tv.find((v) => v.versionNo === t.current_version)!;
        transcript = {
          currentVersion: t.current_version,
          approval: t.approval,
          approvedAt: t.approved_at ? new Date(t.approved_at).toISOString() : null,
          text: c.text,
          origin: c.origin as TranscriptView["origin"],
          provenance: transcriptProvenance(t.approval),
          versions: tv,
        };
      }
      media.push({
        id: m.id,
        kind: m.kind,
        mimeType: m.mime_type,
        byteSize: Number(m.byte_size),
        sha256: m.sha256,
        originalFilename: m.original_filename,
        capture: m.capture,
        createdAt: new Date(m.created_at).toISOString(),
        provenance: "P1_original_recording",
        transcript,
      });
    }
    const tags = (await db.query("select id, kind, label, origin, state from memory_tag where memory_id = $1 order by kind, lower(label)", [memoryId])).rows;
    const audienceRecipientIds = (await db.query("select recipient_id from memory_audience where memory_id = $1", [memoryId])).rows.map((r) => r.recipient_id as string);
    const recipients = (await db.query("select id, display_name, is_minor from recipient where legacy_id = $1 order by created_at", [legacyId])).rows.map((r) => ({
      id: r.id as string,
      displayName: r.display_name as string,
      isMinor: r.is_minor as boolean,
    }));
    return {
      id: i.id,
      legacyId: i.legacy_id,
      kind: i.kind,
      approval: i.approval,
      approvedAt: i.approved_at ? new Date(i.approved_at).toISOString() : null,
      sensitivity: i.sensitivity,
      audience: i.audience,
      currentVersion: i.current_version,
      current: { title: cur.title, body: cur.body, occurredLabel: cur.occurredLabel, createdAt: cur.createdAt },
      textProvenance: "P2_author_written",
      versions,
      media,
      tags: tags.map((t) => ({ id: t.id, kind: t.kind, label: t.label, origin: t.origin, state: t.state })),
      audienceRecipientIds,
      recipients,
      citable: i.approval === "approved",
      prompt: i.prompt_id ? { id: i.prompt_id, theme: i.prompt_theme, text: i.prompt_text } : null,
    };
  });
}

export interface CitableSource {
  sourceType: "memory_version" | "media_asset" | "transcript_version";
  sourceId: string;
  memoryId: string;
  provenance: Provenance;
  title: string;
  text: string | null;
  mediaAssetId: string | null;
  sensitivity: "standard" | "sensitive";
  approvedAt: string;
}

/**
 * The retrieval boundary for slice 3: approved material only, read through the `citable_source` view.
 * Nothing unapproved (P6) can appear here by construction (AC-04).
 */
export async function citableSources(ctx: AuthContext, legacyId: string): Promise<CitableSource[]> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const { rows } = await db.query(
      `select source_type, source_id, memory_id, provenance, title, text, media_asset_id, sensitivity, approved_at
         from citable_source where legacy_id = $1 order by memory_id, source_type`,
      [legacyId],
    );
    return rows.map((r) => ({
      sourceType: r.source_type,
      sourceId: r.source_id,
      memoryId: r.memory_id,
      provenance: r.provenance,
      title: r.title,
      text: r.text,
      mediaAssetId: r.media_asset_id,
      sensitivity: r.sensitivity,
      approvedAt: new Date(r.approved_at).toISOString(),
    }));
  });
}
