import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll } from "vitest";
import { LocalBlobStore, setBlobStore } from "../src/server/storage";

/** A real, playable 16-bit mono PCM WAV (sine tone). Synthetic test audio, not a person's voice. */
export function wav(seconds = 0.25, freq = 440, rate = 8000): Buffer {
  const samples = Math.floor(seconds * rate);
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 12000), i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0, "latin1");
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8, "latin1");
  h.write("fmt ", 12, "latin1");
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36, "latin1");
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/** Bytes with a WebM/EBML signature (enough for type detection; not decoded by tests). */
export function webmLike(size = 256): Buffer {
  return Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), randomBytes(size)]);
}

export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Gives the test file its own temporary blob directory. */
export function useTempBlobStore(): () => string {
  let dir = "";
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "echo-blobs-"));
    setBlobStore(new LocalBlobStore(dir));
  });
  afterAll(() => {
    setBlobStore(undefined);
    rmSync(dir, { recursive: true, force: true });
  });
  return () => dir;
}
