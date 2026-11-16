/**
 * Same-site check that never throws. Browsers send Sec-Fetch-Site on every request; because this site uses
 * Referrer-Policy: no-referrer, Chrome sends "Origin: null" on its own form posts, so Origin alone cannot be used.
 */
export function isSameOrigin(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = headers.get("origin");
  const host = headers.get("host");
  if (!origin || !host || origin === "null") return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
