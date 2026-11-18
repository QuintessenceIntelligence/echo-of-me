import { z } from "zod";
import { withActor, type Queryable } from "../server/db";
import { audit, guarded } from "./audit";
import { requireMfa, type AuthContext } from "./auth";
import { assertConsents } from "./consent";
import { NotFoundError, PolicyError, ValidationError } from "./errors";
import { ownedLegacy } from "./onboarding";
import { enforceLimit } from "./limits";

/**
 * Sharing with adult recipients (slice 5, ADR-009). The author shares approved items with named
 * recipients; recipients read them and ask questions about them. Access is re-checked by the database on
 * every read (app.shared_with_me), so it ends the moment an item is unapproved, a recipient is removed or
 * revoked, or the author withdraws the sharing consent.
 */

const UUID = z.uuid();

export type ShareEligibility = "ok" | "minor" | "not_invited" | "revoked" | "left";

export interface ShareTarget {
  recipientId: string;
  displayName: string;
  invitationStatus: "not_invited" | "invited" | "accepted" | "revoked" | "left";
  isMinor: boolean;
  eligibility: ShareEligibility;
  shared: boolean;
  grantedAt: string | null;
}

export interface ItemSharing {
  memoryId: string;
  approved: boolean;
  sensitive: boolean;
  targets: ShareTarget[];
}

function eligibility(r: { is_minor: boolean; invitation_status: string }): ShareEligibility {
  if (r.is_minor) return "minor";
  if (r.invitation_status === "not_invited") return "not_invited";
  if (r.invitation_status === "revoked") return "revoked";
  if (r.invitation_status === "left") return "left";
  return "ok";
}

async function loadItem(db: Queryable, legacyId: string, memoryId: string) {
  if (!UUID.safeParse(memoryId).success) throw new NotFoundError("memory");
  const i = (await db.query("select id, approval, sensitivity from memory_item where id = $1 and legacy_id = $2 and app.owns_legacy(legacy_id)", [memoryId, legacyId])).rows[0];
  if (!i) throw new NotFoundError("memory");
  return i as { id: string; approval: string; sensitivity: string };
}

export async function getItemSharing(ctx: AuthContext, legacyId: string, memoryId: string): Promise<ItemSharing> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const item = await loadItem(db, legacyId, memoryId);
    const { rows } = await db.query(
      `select r.id, r.display_name, r.invitation_status, r.is_minor, g.granted_at
         from recipient r left join share_grant g on g.recipient_id = r.id and g.memory_id = $2
        where r.legacy_id = $1 order by r.created_at`,
      [legacyId, memoryId],
    );
    return {
      memoryId,
      approved: item.approval === "approved",
      sensitive: item.sensitivity === "sensitive",
      targets: rows.map((r) => ({
        recipientId: r.id,
        displayName: r.display_name,
        invitationStatus: r.invitation_status,
        isMinor: r.is_minor,
        eligibility: eligibility(r),
        shared: r.granted_at !== null,
        grantedAt: r.granted_at ? new Date(r.granted_at).toISOString() : null,
      })),
    };
  });
}

/**
 * Sets exactly who an item is shared with. Needs a verified second factor (it exposes content to other
 * people), the "share with recipients" consent, an active legacy and an approved item. Recipients must
 * be adults who were invited (access begins when they accept). A sensitive item needs explicit confirmation.
 */
export async function setItemShares(
  ctx: AuthContext,
  legacyId: string,
  memoryId: string,
  recipientIds: string[],
  opts: { confirmSensitive?: boolean } = {},
): Promise<{ added: number; removed: number }> {
  const wanted = [...new Set(recipientIds)];
  if (wanted.length > 200 || wanted.some((id) => !UUID.safeParse(id).success)) throw new NotFoundError("recipient");
  return guarded(ctx, "share.set", { legacyId, targetType: "memory", targetId: memoryId }, async (db) => {
    requireMfa(ctx);
    const legacy = await ownedLegacy(db, ctx, legacyId);
    const item = await loadItem(db, legacyId, memoryId);
    const current = (await db.query("select recipient_id from share_grant where memory_id = $1", [memoryId])).rows.map((r) => r.recipient_id as string);
    const toAdd = wanted.filter((id) => !current.includes(id));
    const toRemove = current.filter((id) => !wanted.includes(id));

    if (toAdd.length) {
      if (legacy.state !== "active") throw new PolicyError("legacy_not_active", "Finish setting up your legacy before sharing.");
      await assertConsents(db, ctx, ["share_with_recipients"]);
      if (item.approval !== "approved") throw new ValidationError("Only approved items can be shared. Approve this item first.");
      if (item.sensitivity === "sensitive" && !opts.confirmSensitive) {
        throw new ValidationError("This item is marked sensitive. Please confirm that you want to share it.");
      }
      const found = (await db.query(
        "select id, is_minor, invitation_status from recipient where legacy_id = $1 and id = any($2::uuid[])",
        [legacyId, toAdd],
      )).rows;
      if (found.length !== toAdd.length) throw new NotFoundError("recipient");
      const blocked = found.find((r) => eligibility(r) !== "ok");
      if (blocked) {
        const why = { minor: "Children cannot receive shared items in this version.", not_invited: "Invite this person before sharing with them.", revoked: "This person's invitation was cancelled. Invite them again first.", left: "This person left your legacy. Invite them again first if you both wish." }[eligibility(blocked) as Exclude<ShareEligibility, "ok">];
        throw new ValidationError(why);
      }
    }
    for (const rid of toRemove) {
      await db.query("delete from share_grant where memory_id = $1 and recipient_id = $2", [memoryId, rid]);
      await audit(db, ctx, { action: "share.revoke", legacyId, targetType: "memory", targetId: memoryId, detail: { recipient: rid } });
    }
    for (const rid of toAdd) {
      await db.query(
        "insert into share_grant (memory_id, recipient_id, legacy_id, granted_by, sensitive_confirmed) values ($1, $2, $3, $4, $5)",
        [memoryId, rid, legacyId, ctx.accountId, item.sensitivity === "sensitive"],
      );
      await audit(db, ctx, { action: "share.grant", legacyId, targetType: "memory", targetId: memoryId, detail: { recipient: rid, sensitive: item.sensitivity === "sensitive" } });
    }
    return { added: toAdd.length, removed: toRemove.length };
  });
}

/** Stops sharing every item with one recipient (the recipient record and invitation stay). */
export async function stopSharingWith(ctx: AuthContext, legacyId: string, recipientId: string): Promise<{ removed: number }> {
  if (!UUID.safeParse(recipientId).success) throw new NotFoundError("recipient");
  return guarded(ctx, "share.revoke_all", { legacyId, targetType: "recipient", targetId: recipientId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    if (!(await db.query("select 1 from recipient where id = $1 and legacy_id = $2", [recipientId, legacyId])).rowCount) throw new NotFoundError("recipient");
    const res = await db.query("delete from share_grant where recipient_id = $1 and legacy_id = $2", [recipientId, legacyId]);
    await audit(db, ctx, { action: "share.revoke_all", legacyId, targetType: "recipient", targetId: recipientId, detail: { grants: res.rowCount ?? 0 } });
    return { removed: res.rowCount ?? 0 };
  });
}

/** Per recipient: how many items are shared with them (author dashboard). */
export async function sharingSummary(ctx: AuthContext, legacyId: string): Promise<{ recipientId: string; shared: number }[]> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const { rows } = await db.query(
      "select r.id, count(g.memory_id)::int as n from recipient r left join share_grant g on g.recipient_id = r.id where r.legacy_id = $1 group by r.id",
      [legacyId],
    );
    return rows.map((r) => ({ recipientId: r.id, shared: r.n }));
  });
}

// ------------------------------------------------------------------ recipient side

export interface SharedItem {
  memoryId: string;
  kind: "memory" | "value_statement";
  title: string;
  body: string;
  occurredLabel: string | null;
  approvedAt: string;
  media: { id: string; kind: "audio" | "image"; transcript: string | null }[];
}

export interface SharedLegacy {
  legacyId: string;
  legacyTitle: string;
  authorDisplayName: string;
  answersOn: boolean;
  items: SharedItem[];
}

async function membership(db: Queryable, legacyId: string) {
  if (!UUID.safeParse(legacyId).success) throw new NotFoundError("legacy");
  const m = (await db.query("select legacy_id, legacy_title, author_display_name from app.my_recipient_memberships() where legacy_id = $1", [legacyId])).rows[0];
  if (!m || !(await db.query("select app.is_member($1) as ok", [legacyId])).rows[0].ok) throw new NotFoundError("legacy");
  return m as { legacy_id: string; legacy_title: string; author_display_name: string };
}

/** What a recipient may see: the current approved words, originals and approved transcripts of shared items. */
export async function listSharedItems(ctx: AuthContext, legacyId: string): Promise<SharedLegacy> {
  return guarded(ctx, "shared.view", { legacyId, targetType: "legacy", targetId: legacyId }, async (db) => {
    const m = await membership(db, legacyId);
    const items = (await db.query(
      `select i.id, i.kind, i.approved_at, v.title, v.body, v.occurred_label
         from memory_item i join memory_version v on v.memory_id = i.id and v.version_no = i.current_version
        where i.legacy_id = $1 and app.shared_with_me(i.id)
        order by i.approved_at desc, i.id`,
      [legacyId],
    )).rows;
    const out: SharedItem[] = [];
    for (const it of items) {
      const media = (await db.query(
        `select m.id, m.kind,
                (select tv.text from transcript t join transcript_version tv on tv.media_asset_id = t.media_asset_id and tv.version_no = t.current_version
                  where t.media_asset_id = m.id and t.approval = 'approved') as transcript
           from media_asset m where m.memory_id = $1 order by m.created_at`,
        [it.id],
      )).rows.map((r) => ({ id: r.id as string, kind: r.kind as "audio" | "image", transcript: (r.transcript as string | null) ?? null }));
      out.push({
        memoryId: it.id,
        kind: it.kind,
        title: it.title,
        body: it.body,
        occurredLabel: it.occurred_label,
        approvedAt: new Date(it.approved_at).toISOString(),
        media,
      });
    }
    const answersOn = (await db.query("select app.author_has_consent($1, 'ai_processing') as ok", [legacyId])).rows[0].ok as boolean;
    await audit(db, ctx, { action: "shared.view", legacyId, targetType: "legacy", targetId: legacyId, detail: { items: out.length } });
    return { legacyId, legacyTitle: m.legacy_title, authorDisplayName: m.author_display_name, answersOn, items: out };
  });
}

/** Memberships with the number of items currently visible to the recipient. */
export async function myMemberships(ctx: AuthContext): Promise<{ legacyId: string; legacyTitle: string; authorDisplayName: string; acceptedAt: string; sharedCount: number }[]> {
  return withActor(ctx.accountId, async (db) => {
    const { rows } = await db.query(
      `select m.legacy_id, m.legacy_title, m.author_display_name, m.accepted_at,
              (select count(*)::int from memory_item i where i.legacy_id = m.legacy_id and app.shared_with_me(i.id)) as n
         from app.my_recipient_memberships() m order by m.accepted_at`,
    );
    return rows.map((r) => ({
      legacyId: r.legacy_id,
      legacyTitle: r.legacy_title,
      authorDisplayName: r.author_display_name,
      acceptedAt: new Date(r.accepted_at).toISOString(),
      sharedCount: r.n,
    }));
  });
}

// ------------------------------------------------------------------ answer reports

export const REPORT_REASONS = ["not_what_they_meant", "upsetting", "wrong_or_outdated", "other"] as const;

const ReportInput = z.object({
  reason: z.enum(REPORT_REASONS, "Please choose a reason."),
  note: z.string().trim().max(500, "Please keep the note under 500 characters.").optional().transform((v) => v || null),
  includeQuestion: z.boolean().optional().default(false),
});

/** A recipient tells the author an answer was wrong or upsetting. The question is included only if they choose. */
export async function reportAnswer(ctx: AuthContext, legacyId: string, turnId: string, input: z.input<typeof ReportInput>): Promise<{ reportId: string }> {
  const p = ReportInput.safeParse(input);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  if (!UUID.safeParse(turnId).success) throw new NotFoundError("answer");
  await enforceLimit(ctx, "report", legacyId);
  return guarded(ctx, "answer.report", { legacyId, targetType: "recipient_turn", targetId: turnId }, async (db) => {
    await membership(db, legacyId);
    const t = (await db.query("select question, kind, evidence, source_ids from recipient_turn where id = $1 and legacy_id = $2", [turnId, legacyId])).rows[0];
    if (!t) throw new NotFoundError("answer");
    if (t.kind !== "grounded" && t.kind !== "not_recorded") throw new ValidationError("This kind of message cannot be reported.");
    const existing = (await db.query("select id from answer_report where turn_id = $1", [turnId])).rows[0];
    if (existing) return { reportId: existing.id as string };
    const { rows } = await db.query(
      `insert into answer_report (legacy_id, turn_id, reported_by, reason, note, question, source_ids, evidence)
       values ($1, $2, $3, $4, $5, $6, $7::uuid[], $8) returning id`,
      [legacyId, turnId, ctx.accountId, p.data.reason, p.data.note, p.data.includeQuestion ? t.question : null, t.source_ids, t.evidence],
    );
    await audit(db, ctx, { action: "answer.report", legacyId, targetType: "answer_report", targetId: rows[0].id, detail: { reason: p.data.reason } });
    return { reportId: rows[0].id as string };
  });
}

export interface ReportView {
  id: string;
  reason: (typeof REPORT_REASONS)[number];
  note: string | null;
  question: string | null;
  evidence: string | null;
  sources: { memoryId: string; title: string }[];
  reporter: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function listReports(ctx: AuthContext, legacyId: string): Promise<ReportView[]> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const { rows } = await db.query(
      `select a.id, a.reason, a.note, a.question, a.evidence, a.source_ids, a.created_at, a.resolved_at, r.display_name as reporter
         from answer_report a left join recipient r on r.legacy_id = a.legacy_id and r.account_id = a.reported_by
        where a.legacy_id = $1 order by a.resolved_at nulls first, a.created_at desc`,
      [legacyId],
    );
    const out: ReportView[] = [];
    for (const r of rows) {
      const sources = (await db.query(
        `select distinct c.memory_id, c.title from citable_source c where c.legacy_id = $1 and c.source_id = any($2::uuid[])`,
        [legacyId, r.source_ids],
      )).rows.map((s) => ({ memoryId: s.memory_id as string, title: s.title as string }));
      out.push({
        id: r.id,
        reason: r.reason,
        note: r.note,
        question: r.question,
        evidence: r.evidence,
        sources,
        reporter: r.reporter,
        createdAt: new Date(r.created_at).toISOString(),
        resolvedAt: r.resolved_at ? new Date(r.resolved_at).toISOString() : null,
      });
    }
    return out;
  });
}

export async function resolveReport(ctx: AuthContext, legacyId: string, reportId: string): Promise<void> {
  if (!UUID.safeParse(reportId).success) throw new NotFoundError("report");
  await guarded(ctx, "answer.report_resolve", { legacyId, targetType: "answer_report", targetId: reportId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const res = await db.query("update answer_report set resolved_at = now() where id = $1 and legacy_id = $2 and resolved_at is null", [reportId, legacyId]);
    if (!res.rowCount) throw new NotFoundError("report");
    await audit(db, ctx, { action: "answer.report_resolve", legacyId, targetType: "answer_report", targetId: reportId });
  });
}
