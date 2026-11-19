import { z } from "zod";
import { withActor, type Queryable } from "../server/db";
import { guarded } from "./audit";
import type { AuthContext } from "./auth";
import { NotFoundError, PolicyError, ValidationError } from "./errors";
import { enforceLimit } from "./limits";
import { CHUNK_BYTES, MAX_BYTES, type AllowedMime } from "./media-type";
import { ownedLegacy } from "./onboarding";
import { MAX_LEGACY_MEDIA_BYTES, storeMedia } from "./vault";

/**
 * Chunked uploads (ADR-016). Hosting limits each request body (about 4.5 MB on Vercel), so files larger
 * than one chunk arrive in pieces. The pieces are private to the author and are only ever combined and
 * checked by storeMedia, exactly like a single upload: type from the bytes, consent for audio, quota,
 * byte-identical storage with SHA-256. Nothing is visible anywhere until the upload is finished.
 */
const MAX_OPEN_PER_LEGACY = 3;
const STALE_AFTER = "1 hour";
const UUID = z.uuid();

const StartInput = z.object({
  size: z.number().int().min(1).max(MAX_BYTES.audio, `Files can be at most ${MAX_BYTES.audio / 1024 / 1024} MB.`),
  capture: z.enum(["upload", "browser_recording"]),
  filename: z.string().max(200).optional().nullable(),
});

export async function startUpload(
  ctx: AuthContext,
  legacyId: string,
  memoryId: string,
  input: z.input<typeof StartInput>,
): Promise<{ uploadId: string; chunkBytes: number; chunks: number }> {
  const p = StartInput.safeParse(input);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  if (!UUID.safeParse(legacyId).success || !UUID.safeParse(memoryId).success) throw new NotFoundError("memory");
  await enforceLimit(ctx, "upload", legacyId); // counted once per upload, however many pieces it has
  return guarded(ctx, "media.upload_start", { legacyId, targetType: "memory", targetId: memoryId }, async (db) => {
    const l = await ownedLegacy(db, ctx, legacyId);
    if (l.state !== "draft" && l.state !== "active") throw new PolicyError("legacy_locked", "This legacy is not open for changes.");
    if (!(await db.query("select 1 from memory_item where id = $1 and legacy_id = $2", [memoryId, legacyId])).rowCount) throw new NotFoundError("memory");
    await db.query(`delete from upload_session where legacy_id = $1 and created_at < clock_timestamp() - interval '${STALE_AFTER}'`, [legacyId]);
    const open = Number((await db.query("select count(*) as n from upload_session where legacy_id = $1", [legacyId])).rows[0].n);
    if (open >= MAX_OPEN_PER_LEGACY) throw new PolicyError("too_many_uploads", "Please wait for your other uploads to finish, then try again.");
    const used = Number((await db.query("select coalesce(sum(byte_size), 0) as n from media_asset where legacy_id = $1", [legacyId])).rows[0].n);
    if (used + p.data.size > MAX_LEGACY_MEDIA_BYTES) throw new PolicyError("storage_full", "This legacy has reached its storage limit for the test version.");
    const { rows } = await db.query(
      `insert into upload_session (legacy_id, memory_id, created_by, capture, filename, declared_size, chunk_size)
       values ($1, $2, $3, $4, $5, $6, $7) returning id`,
      [legacyId, memoryId, ctx.accountId, p.data.capture, p.data.filename?.slice(0, 200) || null, p.data.size, CHUNK_BYTES],
    );
    return { uploadId: rows[0].id as string, chunkBytes: CHUNK_BYTES, chunks: Math.ceil(p.data.size / CHUNK_BYTES) };
  });
}

interface SessionRow {
  id: string;
  legacy_id: string;
  memory_id: string;
  capture: "upload" | "browser_recording";
  filename: string | null;
  declared_size: number;
  chunk_size: number;
}

async function session(db: Queryable, uploadId: string): Promise<SessionRow> {
  if (!UUID.safeParse(uploadId).success) throw new NotFoundError("upload");
  const r = (await db.query(
    `select id, legacy_id, memory_id, capture, filename, declared_size, chunk_size from upload_session
      where id = $1 and created_at >= clock_timestamp() - interval '${STALE_AFTER}'`,
    [uploadId],
  )).rows[0] as SessionRow | undefined;
  if (!r) throw new NotFoundError("upload");
  return r;
}

/** Stores one piece. Sending the same piece twice is harmless (a retry after a dropped connection). */
export async function putChunk(ctx: AuthContext, uploadId: string, seq: number, bytes: Buffer): Promise<void> {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new ValidationError("Empty piece.");
  await withActor(ctx.accountId, async (db) => {
    const s = await session(db, uploadId);
    const count = Math.ceil(s.declared_size / s.chunk_size);
    if (!Number.isInteger(seq) || seq < 0 || seq >= count) throw new ValidationError("Unexpected piece.");
    const expected = seq === count - 1 ? s.declared_size - s.chunk_size * (count - 1) : s.chunk_size;
    if (bytes.length !== expected) throw new ValidationError("A piece of the file has the wrong size. Please try again.");
    await db.query("insert into upload_chunk (upload_id, legacy_id, seq, bytes) values ($1, $2, $3, $4) on conflict (upload_id, seq) do nothing", [
      s.id,
      s.legacy_id,
      seq,
      bytes,
    ]);
  });
}

/** Combines the pieces, then checks and stores the file like a single upload. The pieces are removed either way. */
export async function finishUpload(ctx: AuthContext, uploadId: string): Promise<{ assetId: string; mimeType: AllowedMime; sha256: string; byteSize: number }> {
  const { s, bytes } = await withActor(ctx.accountId, async (db) => {
    const s = await session(db, uploadId);
    const rows = (await db.query("select seq, bytes from upload_chunk where upload_id = $1 order by seq", [s.id])).rows as { seq: number; bytes: Buffer }[];
    const count = Math.ceil(s.declared_size / s.chunk_size);
    const complete = rows.length === count && rows.every((r, i) => r.seq === i);
    return { s, bytes: complete ? Buffer.concat(rows.map((r) => r.bytes)) : null };
  });
  try {
    if (!bytes || bytes.length !== s.declared_size) throw new ValidationError("Part of the file did not arrive. Please upload it again.");
    return await storeMedia(ctx, s.legacy_id, s.memory_id, { bytes, filename: s.filename ?? undefined, capture: s.capture });
  } finally {
    await withActor(ctx.accountId, (db) => db.query("delete from upload_session where id = $1", [s.id])).catch(() => undefined);
  }
}
