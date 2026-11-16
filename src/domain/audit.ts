import { withActor, type Queryable } from "../server/db";
import type { AuthContext } from "./auth";
import { DomainError } from "./errors";

export interface AuditInput {
  action: string; // dotted, lower-case, e.g. "recipient.add"
  legacyId?: string | null;
  targetType?: string;
  targetId?: string | null;
  outcome?: "success" | "denied" | "error";
  /** Minimised: identifiers and codes only. Never names, emails or memory content. */
  detail?: Record<string, string | number | boolean | null>;
}

export async function audit(db: Queryable, ctx: AuthContext, e: AuditInput): Promise<void> {
  await db.query(
    `insert into audit_event (actor_account_id, legacy_id, action, target_type, target_id, outcome, detail)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      ctx.accountId,
      e.legacyId ?? null,
      e.action,
      e.targetType ?? null,
      e.targetId ?? null,
      e.outcome ?? "success",
      JSON.stringify(e.detail ?? {}),
    ],
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Runs an author action inside an RLS-scoped transaction. If the action is refused by policy, the
 * transaction rolls back and the refusal is written to the audit log in a separate transaction,
 * so refused attempts are never lost.
 */
export async function guarded<T>(
  ctx: AuthContext,
  action: string,
  target: { legacyId?: string | null; targetType?: string; targetId?: string | null },
  fn: (db: Queryable) => Promise<T>,
): Promise<T> {
  try {
    return await withActor(ctx.accountId, fn);
  } catch (err) {
    if (err instanceof DomainError && err.code !== "validation") {
      const safeId = (v?: string | null) => (v && UUID_RE.test(v) ? v : null);
      await withActor(ctx.accountId, (db) =>
        audit(db, ctx, {
          action,
          legacyId: safeId(target.legacyId),
          targetType: target.targetType,
          targetId: safeId(target.targetId),
          outcome: "denied",
          detail: { reason: err.code },
        }),
      ).catch(() => undefined);
    }
    throw err;
  }
}
