import { withActor } from "../server/db";
import { audit } from "./audit";
import type { AuthContext } from "./auth";
import { PolicyError } from "./errors";

/**
 * Per-account rate limits (ADR-012). Generous for real use, tight enough to stop scripted abuse and,
 * later, runaway AI costs. Attempts are counted in the database (app.rate_limit_hit) in their own
 * committed transaction BEFORE the action runs, so failed or refused attempts count too and limits hold
 * across server instances. The first refusal in each window is written to the activity log; further
 * refusals in the same window are not, so a flood of attempts cannot flood the log.
 */
export const LIMITS = {
  ask: { max: 60, windowSeconds: 10 * 60 },           // practice questions
  recipient_ask: { max: 30, windowSeconds: 10 * 60 }, // recipient questions
  upload: { max: 40, windowSeconds: 60 * 60 },        // recordings and photos
  invite: { max: 20, windowSeconds: 60 * 60 },        // invitation links
  export: { max: 10, windowSeconds: 60 * 60 },        // full exports
  report: { max: 20, windowSeconds: 60 * 60 },        // answer reports
} as const satisfies Record<string, { max: number; windowSeconds: number }>;

export type LimitName = keyof typeof LIMITS;

let overrides: Partial<Record<LimitName, { max: number; windowSeconds: number }>> = {};

/** Tests only: change a limit. Pass undefined to restore the default. */
export function setLimitForTests(name: LimitName, value: { max: number; windowSeconds: number } | undefined): void {
  if (value) overrides[name] = value;
  else delete overrides[name];
}

export function resetLimitsForTests(): void {
  overrides = {};
}

export function limitFor(name: LimitName): { max: number; windowSeconds: number } {
  return overrides[name] ?? LIMITS[name];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Counts one attempt for the signed-in account; throws PolicyError("rate_limited") over the limit. */
export async function enforceLimit(ctx: AuthContext, name: LimitName, legacyId?: string | null): Promise<void> {
  const l = limitFor(name);
  const refused = await withActor(ctx.accountId, async (db) => {
    const hits = (await db.query("select app.rate_limit_hit($1, $2) as hits", [name, l.windowSeconds])).rows[0].hits as number;
    if (hits <= l.max) return false;
    if (hits === l.max + 1) {
      await audit(db, ctx, {
        action: "rate_limit.refused",
        legacyId: legacyId && UUID_RE.test(legacyId) ? legacyId : null,
        outcome: "denied",
        detail: { limit: name, max: l.max, window_seconds: l.windowSeconds },
      });
    }
    return true;
  });
  if (refused) {
    const minutes = Math.max(1, Math.round(l.windowSeconds / 60));
    throw new PolicyError("rate_limited", `You are doing that very often. Please wait a little (up to ${minutes} minutes) and try again.`);
  }
}
