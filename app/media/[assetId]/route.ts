import { DomainError } from "../../../src/domain/errors";
import { readMedia } from "../../../src/domain/vault";
import { readSession } from "../../../src/server/session";

/**
 * Serves an original recording or photo to its author only (RLS decides; recipients get nothing yet).
 * The bytes are verified against the stored SHA-256 before they are sent (AC-03).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const ctx = await readSession();
  if (!ctx) return new Response("Not found", { status: 404 });
  const { assetId } = await params;
  try {
    const m = await readMedia(ctx, assetId);
    return new Response(new Uint8Array(m.bytes), {
      headers: {
        "Content-Type": m.mimeType,
        "Content-Length": String(m.bytes.length),
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        ETag: `"${m.sha256}"`,
        "X-Echo-SHA256": m.sha256,
      },
    });
  } catch (err) {
    if (err instanceof DomainError && err.code === "integrity") return new Response("This file failed its integrity check.", { status: 409 });
    if (err instanceof DomainError) return new Response("Not found", { status: 404 });
    console.error(err);
    return new Response("Error", { status: 500 });
  }
}
