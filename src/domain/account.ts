import { z } from "zod";
import { withActor } from "../server/db";
import { audit, guarded } from "./audit";
import { requireMfa, type AuthContext } from "./auth";
import { NotFoundError, PolicyError, ValidationError } from "./errors";
import { enforceLimit } from "./limits";

/**
 * Personal-data rights for every account (ADR-013): see your account, download your own data, leave a
 * legacy you were invited to, and close your account. Authors export and delete their legacy separately
 * (export.ts, deletion.ts): closing an account never deletes a legacy implicitly.
 */

const UUID = z.uuid();

export interface AccountSummary {
  email: string;
  displayName: string;
  createdAt: string;
  ownedLegacy: { id: string; title: string } | null;
  memberships: { legacyId: string; legacyTitle: string; authorDisplayName: string; acceptedAt: string }[];
}

export async function getAccount(ctx: AuthContext): Promise<AccountSummary> {
  return withActor(ctx.accountId, async (db) => {
    const a = (await db.query("select email, display_name, created_at from account where id = $1", [ctx.accountId])).rows[0];
    if (!a) throw new NotFoundError("account");
    const owned = (await db.query("select id, title from legacy where owner_account_id = $1 order by created_at limit 1", [ctx.accountId])).rows[0];
    const m = (await db.query("select legacy_id, legacy_title, author_display_name, accepted_at from app.my_recipient_memberships() order by accepted_at")).rows;
    return {
      email: a.email,
      displayName: a.display_name,
      createdAt: new Date(a.created_at).toISOString(),
      ownedLegacy: owned ? { id: owned.id, title: owned.title } : null,
      memberships: m.map((r) => ({
        legacyId: r.legacy_id,
        legacyTitle: r.legacy_title,
        authorDisplayName: r.author_display_name,
        acceptedAt: new Date(r.accepted_at).toISOString(),
      })),
    };
  });
}

/**
 * A recipient leaves a legacy. Access ends at once; what was shared with them is unshared; their own
 * questions (and any reports about those answers) are deleted. The author's record of them stays, marked
 * "left", so the author can invite them again if both wish. The author's activity log shows that they left.
 */
export async function leaveLegacy(ctx: AuthContext, legacyId: string): Promise<void> {
  if (!UUID.safeParse(legacyId).success) throw new NotFoundError("legacy");
  await guarded(ctx, "membership.leave", { legacyId, targetType: "legacy", targetId: legacyId }, async (db) => {
    const recipientId = (await db.query("select app.leave_legacy($1) as id", [legacyId])).rows[0].id as string | null;
    if (!recipientId) throw new NotFoundError("legacy");
    await audit(db, ctx, { action: "membership.leave", legacyId, targetType: "recipient", targetId: recipientId });
  });
}

/**
 * Closes the signed-in account. Requires a verified second factor and the account's email address typed
 * as confirmation. Someone who authors a legacy must delete it first (a separate, deliberate step).
 * Every membership is left; the account row is anonymised (consent records and the activity log keep
 * the same opaque id and hold no names, emails or content). The caller must end the session.
 */
export async function closeAccount(ctx: AuthContext, confirmEmail: string): Promise<{ membershipsLeft: number }> {
  return guarded(ctx, "account.close", { targetType: "account", targetId: ctx.accountId }, async (db) => {
    requireMfa(ctx);
    const a = (await db.query("select email from account where id = $1", [ctx.accountId])).rows[0];
    if (!a) throw new NotFoundError("account");
    if (typeof confirmEmail !== "string" || confirmEmail.trim().toLowerCase() !== a.email) {
      throw new ValidationError("Type your email address exactly as shown to confirm.", { confirmEmail: "Does not match your email address." });
    }
    if ((await db.query("select 1 from legacy where owner_account_id = $1", [ctx.accountId])).rowCount) {
      throw new PolicyError("owns_legacy", "You author a legacy. Export it if you want a copy, then delete it, before closing your account.");
    }
    // Leave each legacy first, so every author's activity log shows it; then anonymise the account.
    const memberships = (await db.query("select legacy_id from app.my_recipient_memberships()")).rows.map((r) => r.legacy_id as string);
    for (const legacyId of memberships) {
      const recipientId = (await db.query("select app.leave_legacy($1) as id", [legacyId])).rows[0].id as string | null;
      if (recipientId) await audit(db, ctx, { action: "membership.leave", legacyId, targetType: "recipient", targetId: recipientId, detail: { reason: "account_closed" } });
    }
    const left = memberships.length;
    await db.query("select app.close_my_account()");
    await audit(db, ctx, { action: "account.close", targetType: "account", targetId: ctx.accountId, detail: { memberships_left: left } });
    return { membershipsLeft: left };
  });
}

export interface MyDataExport {
  filename: string;
  json: string;
}

/**
 * Everything held about the signed-in account itself (not the content of legacies, which belongs to
 * their authors): account details, consent history, memberships, the questions they asked, reports they
 * made and their own activity log. Requires a verified second factor; counted against the export limit.
 */
export async function exportMyData(ctx: AuthContext): Promise<MyDataExport> {
  await guarded(ctx, "account.export", { targetType: "account", targetId: ctx.accountId }, async () => {
    requireMfa(ctx);
  });
  await enforceLimit(ctx, "export");
  return withActor(ctx.accountId, async (db) => {
    const q = async (sql: string, params: unknown[] = [ctx.accountId]) => (await db.query(sql, params)).rows;
    const account = (await q("select id, email, display_name, created_at from account where id = $1"))[0];
    const consents = await q(
      `select e.purpose, e.action, d.version as document_version, d.body_sha256, e.legacy_id, e.recorded_at
         from consent_event e join consent_document d on d.id = e.consent_document_id
        where e.account_id = $1 order by e.recorded_at`,
    );
    const memberships = await q("select legacy_id, legacy_title, author_display_name, accepted_at from app.my_recipient_memberships() order by accepted_at", []);
    const questions = await q("select id, legacy_id, question, kind, evidence, source_ids, created_at from recipient_turn where asked_by = $1 order by created_at");
    const reports = await q("select id, legacy_id, turn_id, reason, note, question, created_at, resolved_at from answer_report where reported_by = $1 order by created_at");
    const activity = await q("select occurred_at, action, outcome, legacy_id, target_type, target_id, detail from audit_event where actor_account_id = $1 order by occurred_at");
    await audit(db, ctx, { action: "account.export", targetType: "account", targetId: ctx.accountId });
    const doc = {
      format: "echo-of-me-account-data/0.1",
      exported_at: new Date().toISOString(),
      note:
        "Everything Echo of Me holds about your account itself. The memories and values in a legacy belong to its author; " +
        "ask them for a copy. Questions you asked about a person's legacy are listed here and are not visible to the author.",
      account,
      consents,
      memberships,
      questions_you_asked: questions,
      reports_you_made: reports,
      your_activity: activity,
    };
    return { filename: `echo-of-me-my-data-${new Date().toISOString().slice(0, 10)}.json`, json: JSON.stringify(doc, null, 2) };
  });
}
