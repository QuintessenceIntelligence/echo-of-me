/**
 * Chunked uploads (ADR-016): larger files arrive in pieces and are checked and stored exactly like a
 * single upload. Pieces are private, retries are harmless, incomplete uploads store nothing.
 */
import { afterEach, describe, expect, it } from "vitest";
import { ConsentRequiredError, NotFoundError, ValidationError } from "../src/domain/errors";
import { resetLimitsForTests, setLimitForTests } from "../src/domain/limits";
import { CHUNK_BYTES } from "../src/domain/media-type";
import { createLegacy } from "../src/domain/onboarding";
import { finishUpload, putChunk, startUpload } from "../src/domain/uploads";
import { createMemory, readMedia } from "../src/domain/vault";
import { sha256Hex } from "../src/server/storage";
import { useTempBlobStore, wav } from "./fixtures";
import { makePerson, rawAs, rawSystem, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();
useTempBlobStore();
afterEach(() => resetLimitsForTests());
const C = ["terms_of_service", "privacy_notice", "audio_recording"] as const;
const BIG = wav(450); // about 7.2 MB: three pieces

async function author(label: string, consents: readonly string[] = C) {
  const a = await makePerson(label, [...consents] as never);
  const { legacyId } = await createLegacy(a, { title: "L", authorDisplayName: "Dad" });
  const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Long story", body: "A long recording." });
  return { a, legacyId, memoryId };
}

const pieces = (b: Buffer) => Array.from({ length: Math.ceil(b.length / CHUNK_BYTES) }, (_, i) => b.subarray(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES));
const staged = async (legacyId: string) =>
  (await rawSystem<{ n: number }>(pool(), "select (select count(*) from upload_session where legacy_id = $1)::int + (select count(*) from upload_chunk where legacy_id = $1)::int as n", [legacyId]))[0].n;

describe("Chunked uploads", () => {
  it("stores a large recording byte for byte, in any piece order and with retried pieces, then clears the pieces", async () => {
    const { a, legacyId, memoryId } = await author("upBig");
    const { uploadId, chunks } = await startUpload(a, legacyId, memoryId, { size: BIG.length, capture: "browser_recording", filename: "recording.wav" });
    expect(chunks).toBe(3);
    const parts = pieces(BIG);
    await putChunk(a, uploadId, 2, parts[2]);
    await putChunk(a, uploadId, 0, parts[0]);
    await putChunk(a, uploadId, 0, parts[0]); // a retry
    await putChunk(a, uploadId, 1, parts[1]);
    const r = await finishUpload(a, uploadId);
    expect(r).toMatchObject({ mimeType: "audio/wav", byteSize: BIG.length, sha256: sha256Hex(BIG) });
    expect((await readMedia(a, r.assetId)).bytes.equals(BIG)).toBe(true);
    expect(await staged(legacyId)).toBe(0);
  });

  it("stores nothing when a piece is missing, and refuses pieces of the wrong size or position", async () => {
    const { a, legacyId, memoryId } = await author("upMissing");
    const { uploadId } = await startUpload(a, legacyId, memoryId, { size: BIG.length, capture: "upload" });
    const parts = pieces(BIG);
    await expect(putChunk(a, uploadId, 0, parts[0].subarray(1))).rejects.toBeInstanceOf(ValidationError);
    await expect(putChunk(a, uploadId, 3, parts[0])).rejects.toBeInstanceOf(ValidationError);
    await putChunk(a, uploadId, 0, parts[0]);
    await putChunk(a, uploadId, 2, parts[2]);
    await expect(finishUpload(a, uploadId)).rejects.toThrow(/did not arrive/);
    expect(await staged(legacyId)).toBe(0);
    expect((await rawSystem<{ n: number }>(pool(), "select count(*)::int as n from media_asset where legacy_id = $1", [legacyId]))[0].n).toBe(0);
    await expect(finishUpload(a, uploadId)).rejects.toBeInstanceOf(NotFoundError); // one-shot
  });

  it("applies every check of a single upload: audio still needs consent; size and type limits hold", async () => {
    const { a, legacyId, memoryId } = await author("upConsent", ["terms_of_service", "privacy_notice"]);
    const { uploadId } = await startUpload(a, legacyId, memoryId, { size: BIG.length, capture: "upload" });
    for (const [i, p] of pieces(BIG).entries()) await putChunk(a, uploadId, i, p);
    await expect(finishUpload(a, uploadId)).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(await staged(legacyId)).toBe(0);
    await expect(startUpload(a, legacyId, memoryId, { size: 26 * 1024 * 1024, capture: "upload" })).rejects.toBeInstanceOf(ValidationError);
    const junk = Buffer.alloc(CHUNK_BYTES + 10, 7);
    const j = await startUpload(a, legacyId, memoryId, { size: junk.length, capture: "upload" });
    for (const [i, p] of pieces(junk).entries()) await putChunk(a, j.uploadId, i, p);
    await expect(finishUpload(a, j.uploadId)).rejects.toThrow(/not supported/);
  });

  it("keeps pieces private: another family cannot add to, finish or read someone's upload", async () => {
    const { a, legacyId, memoryId } = await author("upOwner");
    const { a: b } = await author("upOther");
    const { uploadId } = await startUpload(a, legacyId, memoryId, { size: BIG.length, capture: "upload" });
    await putChunk(a, uploadId, 0, pieces(BIG)[0]);
    await expect(putChunk(b, uploadId, 1, pieces(BIG)[1])).rejects.toBeInstanceOf(NotFoundError);
    await expect(finishUpload(b, uploadId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(startUpload(b, legacyId, memoryId, { size: 10, capture: "upload" })).rejects.toBeInstanceOf(NotFoundError);
    expect(await rawAs(pool(), b.accountId, "select * from upload_chunk")).toHaveLength(0);
    expect(await rawAs(pool(), b.accountId, "select * from upload_session")).toHaveLength(0);
    await expect(rawAs(pool(), b.accountId, "insert into upload_chunk (upload_id, legacy_id, seq, bytes) values ($1, $2, 1, '\\x00')", [uploadId, legacyId])).rejects.toThrow(/row-level security/);
  });

  it("counts one rate-limit attempt per upload (not per piece), limits open uploads, and drops stale ones", async () => {
    setLimitForTests("upload", { max: 5, windowSeconds: 3600 });
    const { a, legacyId, memoryId } = await author("upLimits");
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push((await startUpload(a, legacyId, memoryId, { size: BIG.length, capture: "upload" })).uploadId);
    await expect(startUpload(a, legacyId, memoryId, { size: 10, capture: "upload" })).rejects.toMatchObject({ code: "too_many_uploads" });
    // Back-date them past an hour (bypassing the no-update trigger as the owner): they no longer count or work.
    await rawSystem(pool(), "begin; set local session_replication_role = replica; update upload_session set created_at = created_at - interval '2 hours'; commit;");
    await expect(putChunk(a, ids[0], 0, pieces(BIG)[0])).rejects.toBeInstanceOf(NotFoundError);
    const fresh = await startUpload(a, legacyId, memoryId, { size: BIG.length, capture: "upload" });
    expect((await rawSystem<{ n: number }>(pool(), "select count(*)::int as n from upload_session where legacy_id = $1", [legacyId]))[0].n).toBe(1);
    for (const [i, p] of pieces(BIG).entries()) await putChunk(a, fresh.uploadId, i, p);
    await finishUpload(a, fresh.uploadId);
    // Five attempts so far (including the refused fourth), limit 5 within the hour: the sixth is refused.
    await expect(startUpload(a, legacyId, memoryId, { size: 10, capture: "upload" })).rejects.toMatchObject({ code: "rate_limited" });
  });
});
