/**
 * Decides a file's type from its first bytes, never from the name or the browser's claim (ADR-006).
 * Only formats listed here are accepted. SVG and other active formats are deliberately excluded.
 */
export type AllowedMime =
  | "audio/webm"
  | "audio/ogg"
  | "audio/mpeg"
  | "audio/wav"
  | "audio/mp4"
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export const EXTENSION: Record<AllowedMime, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/mp4": "m4a",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const ascii = (b: Buffer, start: number, end: number) => b.subarray(start, end).toString("latin1");

export function sniffMime(b: Buffer): AllowedMime | null {
  if (b.length < 12) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "audio/webm"; // EBML (WebM/Matroska)
  if (ascii(b, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WAVE") return "audio/wav";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (ascii(b, 4, 8) === "ftyp") {
    const brand = ascii(b, 8, 12);
    // Audio-only MPEG-4 brands. Video brands (isom, mp42, qt...) are refused: video is out of MVP scope.
    if (["M4A ", "M4B ", "mp4a", "F4A "].includes(brand)) return "audio/mp4";
    return null;
  }
  if (ascii(b, 0, 3) === "ID3") return "audio/mpeg";
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && (b[1] & 0x06) !== 0) return "audio/mpeg"; // MPEG audio frame sync, layer set
  if (b[0] === 0x89 && ascii(b, 1, 4) === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

export function kindOf(mime: AllowedMime): "audio" | "image" {
  return mime.startsWith("audio/") ? "audio" : "image";
}

export const MAX_BYTES = { audio: 25 * 1024 * 1024, image: 10 * 1024 * 1024 } as const;

/** Files larger than this are sent in pieces of this size (ADR-016): below the hosting request limit. */
export const CHUNK_BYTES = 3 * 1024 * 1024;
