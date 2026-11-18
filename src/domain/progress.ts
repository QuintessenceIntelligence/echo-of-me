import { withActor } from "../server/db";
import type { AuthContext } from "./auth";
import { ownedLegacy } from "./onboarding";

/**
 * "Your progress" for the author (slice 6): computed from the author's own records, shown only to them.
 * Nothing new is collected. Mirrors the pilot measures H1 (approved items), H2 (returning to capture)
 * and H4 (how often practice finds nothing recorded).
 */
export interface Progress {
  approvedItems: number;
  draftItems: number;
  recordings: number;
  captureDays: number;
  daysSinceLastCapture: number | null;
  practiceAnswered: number;
  practiceNotRecorded: number;
  sharedItems: number;
  openReports: number;
}

export async function getProgress(ctx: AuthContext, legacyId: string): Promise<Progress> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const r = (await db.query(
      `select
         (select count(*) from memory_item where legacy_id = $1 and approval = 'approved')::int as approved,
         (select count(*) from memory_item where legacy_id = $1 and approval = 'draft')::int as drafts,
         (select count(*) from media_asset where legacy_id = $1)::int as recordings,
         (select count(distinct date_trunc('day', occurred_at)) from audit_event
           where legacy_id = $1 and outcome = 'success' and action in ('memory.create', 'memory.edit', 'media.add', 'transcript.save'))::int as days,
         (select extract(day from now() - max(occurred_at)) from audit_event
           where legacy_id = $1 and outcome = 'success' and action in ('memory.create', 'memory.edit', 'media.add', 'transcript.save'))::int as since,
         (select count(*) from rehearsal_turn where legacy_id = $1 and evidence in ('E1', 'E2'))::int as answered,
         (select count(*) from rehearsal_turn where legacy_id = $1 and evidence = 'E3')::int as not_recorded,
         (select count(distinct memory_id) from share_grant where legacy_id = $1)::int as shared,
         (select count(*) from answer_report where legacy_id = $1 and resolved_at is null)::int as reports`,
      [legacyId],
    )).rows[0];
    return {
      approvedItems: r.approved,
      draftItems: r.drafts,
      recordings: r.recordings,
      captureDays: r.days,
      daysSinceLastCapture: r.since,
      practiceAnswered: r.answered,
      practiceNotRecorded: r.not_recorded,
      sharedItems: r.shared,
      openReports: r.reports,
    };
  });
}
