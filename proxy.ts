import { NextResponse, type NextRequest } from "next/server";
import { authMode } from "./src/server/auth-mode";
import { IDP_COOKIE, MAX_AGE_S, refreshIfDue, SESSION_COOKIE } from "./src/server/idp-cookie";

/**
 * Per-request Content-Security-Policy with a fresh nonce (Next.js 16 "proxy", formerly middleware).
 * Only scripts carrying this request's nonce (Next.js adds it to its own) may run, so injected markup
 * cannot execute script even if an escaping bug slipped in. No inline style attributes are used.
 * Media: the in-browser recorder previews from blob: URLs; originals are served from /media on 'self'.
 */
export function buildCsp(nonce: string, opts: { dev: boolean; hosted: boolean }): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${opts.dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' blob: data:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(opts.hosted ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const hosted = Boolean(process.env.VERCEL) || Boolean(process.env.ECHO_HOSTED);
  const csp = buildCsp(nonce, { dev: process.env.NODE_ENV === "development", hosted });

  // Supabase sign-in (ADR-015): refresh the provider's access token shortly before it expires, so the
  // page sees a valid token; clear the session if the provider has ended it.
  let idp: string | null | undefined;
  if (authMode() === "supabase" && request.cookies.has(IDP_COOKIE)) {
    idp = await refreshIfDue(request.cookies.get(IDP_COOKIE)?.value);
    if (idp) request.cookies.set(IDP_COOKIE, idp);
    else if (idp === null) {
      request.cookies.delete(IDP_COOKIE);
      request.cookies.delete(SESSION_COOKIE);
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  if (hosted) response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  if (idp) {
    response.cookies.set(IDP_COOKIE, idp, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: MAX_AGE_S });
  } else if (idp === null) {
    response.cookies.delete(IDP_COOKIE);
    response.cookies.delete(SESSION_COOKIE);
  }
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not static assets, and not /media (which sends its own sandboxing policy).
      source: "/((?!_next/static|_next/image|favicon.ico|media/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
