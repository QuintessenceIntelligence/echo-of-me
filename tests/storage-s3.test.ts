/**
 * S3-compatible media storage (ADR-014), tested against a local S3 emulator (moto). Supabase Storage's
 * own S3 gateway is NOT tested here: that needs the founder's Supabase connector switch and a bucket.
 * Skipped automatically when moto_server is not installed (pip install "moto[server]").
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { AwsClient } from "aws4fetch";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deleteLegacy } from "../src/domain/deletion";
import { createLegacy } from "../src/domain/onboarding";
import { addMedia, createMemory, IntegrityError, readMedia } from "../src/domain/vault";
import { BlobNotFoundError, S3BlobStore, setBlobStore, sha256Hex, storageBackend, type S3Config } from "../src/server/storage";
import { PNG_1PX, wav } from "./fixtures";
import { makePerson, useFreshDatabase } from "./helpers";

const hasMoto = spawnSync("moto_server", ["--help"], { stdio: "ignore" }).status === 0;

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      srv.close(() => resolve(port));
    });
  });
}

const CREDS = { region: "eu-west-1", accessKeyId: "test-access-key", secretAccessKey: "test-secret-key-do-not-leak" };
const key = (legacy = randomUUID()) => `${legacy}/${randomUUID()}`;

describe.skipIf(!hasMoto)("S3 blob store against an S3 emulator", () => {
  useFreshDatabase();
  let moto: ChildProcess | undefined;
  let endpoint = "";
  const bucket = "echo-media-test";
  let cfg: S3Config;
  let raw: AwsClient;

  beforeAll(async () => {
    const port = await freePort();
    endpoint = `http://127.0.0.1:${port}`;
    moto = spawn("moto_server", ["-H", "127.0.0.1", "-p", String(port)], { stdio: "ignore" });
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${endpoint}/moto-api/`)).ok) break;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    raw = new AwsClient({ ...CREDS, service: "s3" });
    const made = await raw.fetch(`${endpoint}/${bucket}`, {
      method: "PUT",
      body: `<CreateBucketConfiguration><LocationConstraint>${CREDS.region}</LocationConstraint></CreateBucketConfiguration>`,
    });
    expect(made.ok).toBe(true);
    cfg = { endpoint, bucket, ...CREDS };
  }, 20_000);

  afterAll(() => {
    setBlobStore(undefined);
    moto?.kill();
  });

  it("stores and returns originals byte for byte", async () => {
    const s = new S3BlobStore(cfg);
    const bytes = Buffer.concat([Buffer.from([0, 255, 0, 10, 13]), wav()]);
    const k = key();
    expect(await s.put(k, bytes)).toEqual({ sha256: sha256Hex(bytes), size: bytes.length });
    const back = await s.get(k);
    expect(back.equals(bytes)).toBe(true);
  });

  it("reports missing objects, and deleting is idempotent", async () => {
    const s = new S3BlobStore(cfg);
    await expect(s.get(key())).rejects.toBeInstanceOf(BlobNotFoundError);
    const k = key();
    await s.put(k, PNG_1PX);
    await s.delete(k);
    await s.delete(k);
    await expect(s.get(k)).rejects.toBeInstanceOf(BlobNotFoundError);
  });

  it("removes every object of one legacy across listing pages, and nothing of another", async () => {
    const s = new S3BlobStore({ ...cfg, listPageSize: 2 });
    const doomed = randomUUID();
    const kept = randomUUID();
    const doomedKeys = Array.from({ length: 5 }, () => key(doomed));
    const keptKey = key(kept);
    for (const k of [...doomedKeys, keptKey]) await s.put(k, PNG_1PX);
    await s.removeLegacy(doomed);
    for (const k of doomedKeys) await expect(s.get(k)).rejects.toBeInstanceOf(BlobNotFoundError);
    expect((await s.get(keptKey)).equals(PNG_1PX)).toBe(true);
  });

  it("refuses bad keys, ids and configuration before touching the network", async () => {
    const s = new S3BlobStore(cfg);
    for (const bad of ["../etc/passwd", "a/b", `${randomUUID()}/../${randomUUID()}`, `${randomUUID()}/${randomUUID()}?x=1`]) {
      await expect(s.put(bad, PNG_1PX)).rejects.toThrow(/Invalid storage key/);
      await expect(s.get(bad)).rejects.toThrow(/Invalid storage key/);
    }
    await expect(s.removeLegacy("not-a-uuid")).rejects.toThrow(/Invalid legacy id/);
    expect(() => new S3BlobStore({ ...cfg, endpoint: "http://storage.example.com/s3" })).toThrow(/HTTPS/);
    expect(() => new S3BlobStore({ ...cfg, endpoint: "https://user:pw@storage.example.com/s3" })).toThrow(/Invalid storage endpoint/);
    expect(() => new S3BlobStore({ ...cfg, bucket: "Bad_Bucket" })).toThrow(/bucket/);
    expect(() => new S3BlobStore({ ...cfg, secretAccessKey: "" })).toThrow(/incomplete/);
  });

  it("errors never reveal the secret key", async () => {
    const s = new S3BlobStore({ ...cfg, bucket: "no-such-bucket" });
    const err = await s.put(key(), PNG_1PX).catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect(String((err as Error).message)).not.toContain(CREDS.secretAccessKey);
  });

  it("works end to end with the vault: upload, verified read, tamper detection and legacy deletion", async () => {
    setBlobStore(new S3BlobStore(cfg));
    const a = await makePerson("s3Author", ["terms_of_service", "privacy_notice", "audio_recording"]);
    const { legacyId } = await createLegacy(a, { title: "S3 legacy", authorDisplayName: "Mum" });
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Song", body: "A song." });
    const bytes = wav();
    const { assetId } = await addMedia(a, legacyId, memoryId, { bytes, capture: "upload" });
    expect((await readMedia(a, assetId)).bytes.equals(bytes)).toBe(true);

    // Someone changes the stored object behind the app's back: the next read refuses it.
    const tampered = Buffer.from(bytes);
    tampered[tampered.length - 1] ^= 0xff;
    expect((await raw.fetch(`${endpoint}/${bucket}/${legacyId}/${assetId}`, { method: "PUT", body: new Uint8Array(tampered) })).ok).toBe(true);
    await expect(readMedia(a, assetId)).rejects.toBeInstanceOf(IntegrityError);

    await deleteLegacy(a, legacyId, "S3 legacy");
    const listing = await (await raw.fetch(`${endpoint}/${bucket}?list-type=2&prefix=${legacyId}/`)).text();
    expect(listing).not.toContain("<Key>");
    setBlobStore(undefined);
  });
});

describe("Storage backend selection", () => {
  const full = {
    STORAGE_BACKEND: "s3",
    STORAGE_S3_ENDPOINT: "https://ref.storage.supabase.co/storage/v1/s3",
    STORAGE_S3_REGION: "eu-west-1",
    STORAGE_S3_BUCKET: "echo-media",
    STORAGE_S3_ACCESS_KEY_ID: "id",
    STORAGE_S3_SECRET_ACCESS_KEY: "secret",
  };
  it("uses S3 only when selected and fully configured, hosted or not", () => {
    expect(storageBackend(full)).toBe("s3");
    expect(storageBackend({ ...full, VERCEL: "1" })).toBe("s3");
    expect(storageBackend({ ...full, STORAGE_S3_SECRET_ACCESS_KEY: "" })).toBe("unconfigured");
    expect(storageBackend({ ...full, STORAGE_BACKEND: undefined })).toBe("local");
    expect(storageBackend({ ...full, STORAGE_BACKEND: undefined, VERCEL: "1" })).toBe("unconfigured");
  });
});
