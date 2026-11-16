import { DomainError } from "../../../../src/domain/errors";
import { exportLegacy } from "../../../../src/domain/export";
import { getOverview } from "../../../../src/domain/onboarding";
import { isSameOrigin } from "../../../../src/server/same-origin";
import { readSession } from "../../../../src/server/session";

/**
 * Downloads the full export. POST only, and only from this site's own pages (Origin check), so another
 * website cannot trigger it. Needs a verified second factor (enforced in the domain layer).
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return new Response("Forbidden", { status: 403 });
  const ctx = await readSession();
  if (!ctx) return Response.redirect(new URL("/sign-in?next=/legacy/export", req.url), 303);
  const o = await getOverview(ctx);
  if (!o.legacy) return Response.redirect(new URL("/home", req.url), 303);
  try {
    const { zip, filename } = await exportLegacy(ctx, o.legacy.id);
    return new Response(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(zip.length),
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof DomainError && err.code === "mfa_required") {
      return Response.redirect(new URL("/mfa?next=/legacy/export", req.url), 303);
    }
    const msg = err instanceof DomainError ? err.message : "The export could not be created. Nothing was changed.";
    if (!(err instanceof DomainError)) console.error(err);
    return Response.redirect(new URL(`/legacy/export?error=${encodeURIComponent(msg)}`, req.url), 303);
  }
}
