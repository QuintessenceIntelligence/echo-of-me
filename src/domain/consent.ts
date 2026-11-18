import { z } from "zod";
import { withActor, type Queryable } from "../server/db";
import { audit, guarded } from "./audit";
import type { AuthContext } from "./auth";
import { ConsentRequiredError, NotFoundError, ValidationError } from "./errors";

export const CONSENT_PURPOSES = [
  "terms_of_service",
  "privacy_notice",
  "ai_processing",
  "share_with_recipients",
  "audio_recording",
  "recipient_terms",
] as const;
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];

/** Needed before an author can create a legacy. Everything else is optional and purpose-specific. */
export const REQUIRED_AUTHOR_CONSENTS: ConsentPurpose[] = ["terms_of_service", "privacy_notice"];
export const OPTIONAL_AUTHOR_CONSENTS: ConsentPurpose[] = ["ai_processing", "share_with_recipients", "audio_recording"];

export interface ConsentDocument {
  id: string;
  purpose: ConsentPurpose;
  version: string;
  title: string;
  body: string;
  bodySha256: string;
  legalReviewStatus: "draft_not_reviewed" | "reviewed";
}

export type ConsentState = "granted" | "withdrawn" | "never_given" | "needs_reconsent";

export interface ConsentStatus {
  purpose: ConsentPurpose;
  state: ConsentState;
  /** Version and fingerprint of the text the person actually agreed to, with the time (AC-01). */
  agreedVersion: string | null;
  agreedSha256: string | null;
  recordedAt: string | null;
  currentVersion: string;
  currentDocumentId: string;
}

/** The latest published version of each consent text. */
export async function currentDocuments(db: Queryable): Promise<Map<ConsentPurpose, ConsentDocument>> {
  const { rows } = await db.query(
    `select distinct on (purpose) id, purpose, version, title, body, body_sha256, legal_review_status
       from consent_document order by purpose, published_at desc, id desc`,
  );
  return new Map(
    rows.map((r) => [
      r.purpose,
      {
        id: r.id,
        purpose: r.purpose,
        version: r.version,
        title: r.title,
        body: r.body,
        bodySha256: r.body_sha256,
        legalReviewStatus: r.legal_review_status,
      },
    ]),
  );
}

export async function consentStatuses(db: Queryable, ctx: AuthContext): Promise<ConsentStatus[]> {
  const docs = await currentDocuments(db);
  const { rows } = await db.query(
    `select purpose, action, recorded_at, consent_document_id, document_version, body_sha256
       from current_consent where account_id = $1 and legacy_id is null`,
    [ctx.accountId],
  );
  const latest = new Map(rows.map((r) => [r.purpose as ConsentPurpose, r]));
  return CONSENT_PURPOSES.map((purpose) => {
    const doc = docs.get(purpose);
    if (!doc) throw new Error(`No consent text published for ${purpose}`);
    const ev = latest.get(purpose);
    let state: ConsentState = "never_given";
    if (ev?.action === "withdrawn") state = "withdrawn";
    else if (ev?.action === "granted") state = ev.consent_document_id === doc.id ? "granted" : "needs_reconsent";
    return {
      purpose,
      state,
      agreedVersion: ev?.action === "granted" ? ev.document_version : null,
      agreedSha256: ev?.action === "granted" ? ev.body_sha256 : null,
      recordedAt: ev ? new Date(ev.recorded_at).toISOString() : null,
      currentVersion: doc.version,
      currentDocumentId: doc.id,
    };
  });
}

export async function assertConsents(db: Queryable, ctx: AuthContext, purposes: ConsentPurpose[]): Promise<void> {
  const statuses = await consentStatuses(db, ctx);
  const missing = purposes.filter((p) => statuses.find((s) => s.purpose === p)?.state !== "granted");
  if (missing.length) throw new ConsentRequiredError(missing);
}

const GiveInput = z.object({
  purpose: z.enum(CONSENT_PURPOSES),
  /** The exact document the person was shown. Must still be the current version. */
  documentId: z.uuid(),
});

/**
 * Records agreement to the exact text the person was shown (document id = version + SHA-256 of the text).
 * Giving and withdrawing consent need only a signed-in session: withdrawal must be as easy as giving
 * (ADR-004). Actions that expose data to other people (invitations) require MFA instead.
 */
export async function giveConsent(ctx: AuthContext, input: z.input<typeof GiveInput>): Promise<ConsentStatus> {
  const parsed = GiveInput.safeParse(input);
  if (!parsed.success) throw new ValidationError("Unknown consent.");
  const { purpose, documentId } = parsed.data;
  return guarded(ctx, "consent.grant", { targetType: "consent_document", targetId: documentId }, async (db) => {
    const docs = await currentDocuments(db);
    const doc = docs.get(purpose);
    if (!doc || doc.id !== documentId) {
      throw new ValidationError("This consent text has been updated. Please read the current version.");
    }
    await db.query(
      `insert into consent_event (account_id, legacy_id, purpose, consent_document_id, action)
       values ($1, null, $2, $3, 'granted')`,
      [ctx.accountId, purpose, documentId],
    );
    await audit(db, ctx, {
      action: "consent.grant",
      targetType: "consent_document",
      targetId: documentId,
      detail: { purpose, version: doc.version },
    });
    const status = (await consentStatuses(db, ctx)).find((s) => s.purpose === purpose)!;
    return status;
  });
}

/**
 * Withdrawal is always possible and takes effect immediately. Effects that follow from it
 * (consequences) are applied in the same transaction so there is no window where they lag behind.
 */
export async function withdrawConsent(ctx: AuthContext, purpose: ConsentPurpose): Promise<{ revokedInvitations: number }> {
  if (!CONSENT_PURPOSES.includes(purpose)) throw new ValidationError("Unknown consent.");
  return guarded(ctx, "consent.withdraw", {}, async (db) => {
    const statuses = await consentStatuses(db, ctx);
    const s = statuses.find((x) => x.purpose === purpose)!;
    if (s.state === "never_given" || s.state === "withdrawn") throw new NotFoundError("consent");
    await db.query(
      `insert into consent_event (account_id, legacy_id, purpose, consent_document_id, action)
       values ($1, null, $2, $3, 'withdrawn')`,
      [ctx.accountId, purpose, s.currentDocumentId],
    );
    await audit(db, ctx, { action: "consent.withdraw", detail: { purpose } });

    let revokedInvitations = 0;
    if (purpose === "share_with_recipients") {
      // Cancel every invitation that has not been accepted yet, across the author's legacies.
      const res = await db.query(
        `with pending as (
           select i.id, i.recipient_id, i.legacy_id from invitation i
             join legacy l on l.id = i.legacy_id
            where l.owner_account_id = $1 and i.accepted_at is null and i.revoked_at is null
            for update of i)
         , upd as (
           update invitation i set revoked_at = now(), revoked_reason = 'consent_withdrawn'
             from pending p where i.id = p.id returning i.id, i.recipient_id, i.legacy_id)
         update recipient r set invitation_status = 'revoked'
           from upd where r.id = upd.recipient_id and r.invitation_status = 'invited'
         returning upd.id as invitation_id, upd.legacy_id`,
        [ctx.accountId],
      );
      revokedInvitations = res.rowCount ?? 0;
      // Sharing stops too (slice 5): every share grant across the author's legacies is removed. Access was
      // already cut at read time by app.shared_with_me; deleting the grants makes the end explicit.
      const grants = await db.query(
        `delete from share_grant g using legacy l where l.id = g.legacy_id and l.owner_account_id = $1 returning g.legacy_id`,
        [ctx.accountId],
      );
      const perLegacy = new Map<string, number>();
      for (const g of grants.rows) perLegacy.set(g.legacy_id, (perLegacy.get(g.legacy_id) ?? 0) + 1);
      for (const [legacyId, n] of perLegacy) {
        await audit(db, ctx, { action: "share.revoke_all", legacyId, detail: { reason: "consent_withdrawn", grants: n } });
      }
      for (const row of res.rows) {
        await audit(db, ctx, {
          action: "invitation.revoke",
          legacyId: row.legacy_id,
          targetType: "invitation",
          targetId: row.invitation_id,
          detail: { reason: "consent_withdrawn" },
        });
      }
    }
    if (purpose === "ai_processing") {
      // "AI features then stop": automatic suggestions the author has not decided on are removed.
      // Decisions the author already made (approved tags) are the author's own and are kept.
      const res = await db.query(
        `delete from memory_tag t using legacy l
          where l.id = t.legacy_id and l.owner_account_id = $1 and t.origin = 'automatic' and t.state = 'suggested'`,
        [ctx.accountId],
      );
      if (res.rowCount) await audit(db, ctx, { action: "tag.withdraw_suggestions", detail: { removed: res.rowCount } });
    }
    return { revokedInvitations };
  });
}

/** For display: the current text of each consent, so the person reads exactly what they agree to. */
export async function listCurrentDocuments(ctx: AuthContext): Promise<ConsentDocument[]> {
  return withActor(ctx.accountId, async (db) => [...(await currentDocuments(db)).values()]);
}
