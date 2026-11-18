import { exportMyData } from "../../../../src/domain/account";
import { DomainError } from "../../../../src/domain/errors";
import { isSameOrigin } from "../../../../src/server/same-origin";
import { readSession } from "../../../../src/server/session";

/**
 * Downloads everything held about the signed-in account itself (ADR-013). POST only, and only from this
 * site's own pages, so another website cannot trigger it. Needs a verified second factor.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req.headers)) return new Response("Forbidden", { status: 403 });
  const ctx = await readSession();
  if (!ctx) return Response.redirect(new URL("/sign-in?next=/account", req.url), 303);
  try {
    const { json, filename } = await exportMyData(ctx);
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    if (err instanceof DomainError && err.code === "mfa_required") {
      return Response.redirect(new URL("/mfa?next=/account", req.url), 303);
    }
    const msg = err instanceof DomainError ? err.message : "Your data could not be prepared. Nothing was changed.";
    if (!(err instanceof DomainError)) console.error(err);
    return Response.redirect(new URL(`/account?error=${encodeURIComponent(msg)}#data`, req.url), 303);
  }
}
