/**
 * The development sign-in can never be active on a hosted deployment: if the app runs on Vercel
 * (VERCEL is set by the platform) or ECHO_HOSTED is set, dev mode is refused whatever AUTH_MODE says.
 */
export function authMode(env: Record<string, string | undefined> = process.env): "dev" | "unconfigured" {
  const hosted = Boolean(env.VERCEL) || Boolean(env.ECHO_HOSTED);
  return env.AUTH_MODE === "dev" && !hosted ? "dev" : "unconfigured";
}
