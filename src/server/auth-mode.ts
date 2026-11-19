export type AuthMode = "dev" | "supabase" | "unconfigured";

/**
 * Which sign-in is active (ADR-004, ADR-015).
 *  - "dev": development sign-in with a SIMULATED second factor. Never on a hosted deployment: if the app
 *    runs on Vercel (VERCEL is set by the platform) or ECHO_HOSTED is set, dev mode is refused whatever
 *    AUTH_MODE says.
 *  - "supabase": Supabase Auth (email + password, TOTP second factor), only when fully configured.
 *  - anything else: sign-in is unavailable. The app never silently falls back to another mode.
 */
export function authMode(env: Record<string, string | undefined> = process.env): AuthMode {
  const hosted = Boolean(env.VERCEL) || Boolean(env.ECHO_HOSTED);
  if (env.AUTH_MODE === "dev") return hosted ? "unconfigured" : "dev";
  if (env.AUTH_MODE === "supabase") return env.SUPABASE_URL && env.SUPABASE_PUBLISHABLE_KEY ? "supabase" : "unconfigured";
  return "unconfigured";
}
