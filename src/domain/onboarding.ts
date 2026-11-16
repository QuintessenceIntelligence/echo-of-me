import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { withActor, withAnonymous, type Queryable } from "../server/db";
import { audit, guarded } from "./audit";
import { requireMfa, type AuthContext } from "./auth";
import { assertConsents, consentStatuses, currentDocuments, REQUIRED_AUTHOR_CONSENTS, type ConsentStatus } from "./consent";
import { NotFoundError, PolicyError, ValidationError } from "./errors";

// ------------------------------------------------------------------ shared helpers

const name = z.string().trim().min(1, "Please enter a name.").max(120, "Please keep this under 120 characters.");
const optionalEmail = z
  .union([z.literal(""), z.email("Please enter a valid email address.")])
  .optional()
  .transform((v) => (v ? v.toLowerCase() : null));

export function parse<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const r = schema.safeParse(input);
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const issue of r.error.issues) fields[issue.path.join(".") || "_"] = issue.message;
    throw new ValidationError("Please check what you entered.", fields);
  }
  return r.data;
}

/** Application-level ownership check. RLS enforces the same rule underneath (defence in depth). */
export async function ownedLegacy(db: Queryable, ctx: AuthContext, legacyId: string) {
  if (!z.uuid().safeParse(legacyId).success) throw new NotFoundError("legacy");
  const { rows } = await db.query(
    "select id, owner_account_id, state from legacy where id = $1 and owner_account_id = $2",
    [legacyId, ctx.accountId],
  );
  if (!rows[0]) throw new NotFoundError("legacy");
  return rows[0] as { id: string; owner_account_id: string; state: string };
}

// ------------------------------------------------------------------ accounts

const ProvisionInput = z.object({
  authSubject: z.string().min(1).max(255),
  email: z.email().transform((v) => v.toLowerCase()),
  displayName: name,
});

/**
 * Creates (or finds) the account for a person the identity provider has verified.
 * Runs as the unprivileged application role through one SECURITY DEFINER database function
 * (migration 0002), so the running app never needs owner credentials (ADR-005).
 */
export async function provisionAccount(input: z.input<typeof ProvisionInput>): Promise<{ accountId: string; created: boolean }> {
  const p = parse(ProvisionInput, input);
  const r = await withAnonymous(async (db) =>
    (await db.query("select status, account_id from app.provision_account($1, $2, $3)", [p.authSubject, p.email, p.displayName])).rows[0],
  );
  if (r.status === "email_in_use") throw new PolicyError("email_in_use", "An account already uses this email address.");
  if (r.status === "invalid") throw new ValidationError("Please check what you entered.");
  return { accountId: r.account_id as string, created: r.status === "created" };
}

// ------------------------------------------------------------------ legacy

const CreateLegacyInput = z.object({
  title: z.string().trim().min(1, "Please give your legacy a title.").max(160),
  authorDisplayName: name,
  about: z.string().trim().max(2000).optional().transform((v) => v || null),
});

export async function createLegacy(ctx: AuthContext, input: z.input<typeof CreateLegacyInput>): Promise<{ legacyId: string }> {
  const p = parse(CreateLegacyInput, input);
  return guarded(ctx, "legacy.create", {}, async (db) => {
    await assertConsents(db, ctx, REQUIRED_AUTHOR_CONSENTS);
    const { rows } = await db.query(
      `insert into legacy (owner_account_id, title, author_display_name, about)
       values ($1, $2, $3, $4) returning id`,
      [ctx.accountId, p.title, p.authorDisplayName, p.about],
    );
    const legacyId = rows[0].id as string;
    await audit(db, ctx, { action: "legacy.create", legacyId, targetType: "legacy", targetId: legacyId });
    return { legacyId };
  });
}

/** Draft → Active. The author has accepted the required consents and finished setting up. */
export async function completeOnboarding(ctx: AuthContext, legacyId: string): Promise<void> {
  await guarded(ctx, "legacy.activate", { legacyId, targetType: "legacy", targetId: legacyId }, async (db) => {
    const l = await ownedLegacy(db, ctx, legacyId);
    await assertConsents(db, ctx, REQUIRED_AUTHOR_CONSENTS);
    if (l.state !== "draft") return;
    await db.query("update legacy set state = 'active' where id = $1", [legacyId]);
    await audit(db, ctx, { action: "legacy.activate", legacyId, targetType: "legacy", targetId: legacyId });
  });
}

// ------------------------------------------------------------------ recipients

export const RELATIONSHIPS = [
  "child", "stepchild", "grandchild", "partner", "sibling", "other_family", "friend", "other",
] as const;

const AddRecipientInput = z
  .object({
    displayName: name,
    relationship: z.enum(RELATIONSHIPS, "Please choose a relationship."),
    isMinor: z.boolean(),
    email: optionalEmail,
  })
  .refine((v) => !(v.isMinor && v.email), {
    message: "Children are kept as records only, so please leave the email empty.",
    path: ["email"],
  });

/**
 * Adds a recipient record. This grants NO access to anything (AC-02): access only exists once the
 * author explicitly shares content with that person (slice 5).
 */
export async function addRecipient(
  ctx: AuthContext,
  legacyId: string,
  input: z.input<typeof AddRecipientInput>,
): Promise<{ recipientId: string }> {
  const p = parse(AddRecipientInput, input);
  return guarded(ctx, "recipient.add", { legacyId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    if (p.email) {
      const dup = await db.query("select 1 from recipient where legacy_id = $1 and email = $2", [legacyId, p.email]);
      if (dup.rowCount) throw new ValidationError("You have already added someone with this email.", { email: "Already added." });
    }
    const { rows } = await db.query(
      `insert into recipient (legacy_id, display_name, relationship, is_minor, email)
       values ($1, $2, $3, $4, $5) returning id`,
      [legacyId, p.displayName, p.relationship, p.isMinor, p.email],
    );
    const recipientId = rows[0].id as string;
    await audit(db, ctx, {
      action: "recipient.add",
      legacyId,
      targetType: "recipient",
      targetId: recipientId,
      detail: { relationship: p.relationship, is_minor: p.isMinor },
    });
    return { recipientId };
  });
}

export async function removeRecipient(ctx: AuthContext, legacyId: string, recipientId: string): Promise<void> {
  await guarded(ctx, "recipient.remove", { legacyId, targetType: "recipient", targetId: recipientId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const res = await db.query("delete from recipient where id = $1 and legacy_id = $2", [recipientId, legacyId]);
    if (!res.rowCount) throw new NotFoundError("recipient");
    await audit(db, ctx, { action: "recipient.remove", legacyId, targetType: "recipient", targetId: recipientId });
  });
}

// ------------------------------------------------------------------ trusted contact

const TrustedContactInput = z.object({
  displayName: name,
  email: optionalEmail,
  relationship: z.string().trim().max(80).optional().transform((v) => v || null),
});

/** Record only: a trusted contact cannot sign in and has no powers in MVP-1 (DR-042). */
export async function addTrustedContact(
  ctx: AuthContext,
  legacyId: string,
  input: z.input<typeof TrustedContactInput>,
): Promise<{ trustedContactId: string }> {
  const p = parse(TrustedContactInput, input);
  return guarded(ctx, "trusted_contact.add", { legacyId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const { rows } = await db.query(
      `insert into trusted_contact (legacy_id, display_name, email, relationship) values ($1, $2, $3, $4) returning id`,
      [legacyId, p.displayName, p.email, p.relationship],
    );
    const id = rows[0].id as string;
    await audit(db, ctx, { action: "trusted_contact.add", legacyId, targetType: "trusted_contact", targetId: id });
    return { trustedContactId: id };
  });
}

// ------------------------------------------------------------------ invitations

export const INVITATION_TTL_DAYS = 14;

export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Creates an invitation for an adult recipient. Returns the one-time token; only its hash is stored.
 * Requires: MFA, current "share with recipients" consent, an adult recipient with an email address.
 * Email delivery is NOT connected yet (needs a vendor decision); the caller shows the link instead.
 */
export async function inviteRecipient(
  ctx: AuthContext,
  legacyId: string,
  recipientId: string,
): Promise<{ invitationId: string; token: string; expiresAt: Date }> {
  return guarded(ctx, "invitation.create", { legacyId, targetType: "recipient", targetId: recipientId }, async (db) => {
    requireMfa(ctx);
    await ownedLegacy(db, ctx, legacyId);
    await assertConsents(db, ctx, ["share_with_recipients"]);
    const { rows } = await db.query(
      "select id, is_minor, email, invitation_status from recipient where id = $1 and legacy_id = $2 for update",
      [recipientId, legacyId],
    );
    const r = rows[0];
    if (!r) throw new NotFoundError("recipient");
    if (r.is_minor) throw new PolicyError("minor_not_invitable", "Children are kept as records only and cannot be invited yet.");
    if (!r.email) throw new ValidationError("Add an email address before inviting this person.", { email: "Required to invite." });
    if (r.invitation_status === "accepted") throw new PolicyError("already_accepted", "This person has already joined.");

    // Re-inviting cancels any earlier pending invitation for the same person.
    await db.query(
      `update invitation set revoked_at = now(), revoked_reason = 'superseded'
        where recipient_id = $1 and accepted_at is null and revoked_at is null`,
      [recipientId],
    );
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000);
    const ins = await db.query(
      `insert into invitation (recipient_id, legacy_id, token_sha256, expires_at) values ($1, $2, $3, $4) returning id`,
      [recipientId, legacyId, hashToken(token), expiresAt],
    );
    await db.query("update recipient set invitation_status = 'invited' where id = $1", [recipientId]);
    const invitationId = ins.rows[0].id as string;
    await audit(db, ctx, { action: "invitation.create", legacyId, targetType: "invitation", targetId: invitationId });
    return { invitationId, token, expiresAt };
  });
}

export async function revokeInvitation(ctx: AuthContext, legacyId: string, recipientId: string): Promise<void> {
  await guarded(ctx, "invitation.revoke", { legacyId, targetType: "recipient", targetId: recipientId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const res = await db.query(
      `update invitation set revoked_at = now(), revoked_reason = 'author_revoked'
        where recipient_id = $1 and legacy_id = $2 and accepted_at is null and revoked_at is null returning id`,
      [recipientId, legacyId],
    );
    if (!res.rowCount) throw new NotFoundError("invitation");
    await db.query("update recipient set invitation_status = 'revoked' where id = $1 and invitation_status = 'invited'", [recipientId]);
    await audit(db, ctx, { action: "invitation.revoke", legacyId, targetType: "invitation", targetId: res.rows[0].id, detail: { reason: "author_revoked" } });
  });
}

/**
 * Recipient side: accept with the token from the link, agreeing to the recipient terms the person was
 * shown. The database function re-checks token, expiry, revocation and email match, and records refusals
 * in the audit log (the refusal is committed, then reported).
 */
export async function acceptInvitation(
  ctx: AuthContext,
  token: string,
  recipientTermsDocumentId: string,
): Promise<{ legacyId: string }> {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) throw new NotFoundError("invitation");
  const outcome = await withActor(ctx.accountId, async (db) => {
    const doc = (await currentDocuments(db)).get("recipient_terms")!;
    if (doc.id !== recipientTermsDocumentId) return { status: "terms_outdated" as const, legacyId: null };
    const { rows } = await db.query("select status, legacy_id from app.accept_invitation($1)", [token]);
    const r = rows[0];
    if (r.status === "accepted") {
      await db.query(
        `insert into consent_event (account_id, legacy_id, purpose, consent_document_id, action)
         values ($1, null, 'recipient_terms', $2, 'granted')`,
        [ctx.accountId, doc.id],
      );
      await audit(db, ctx, {
        action: "consent.grant",
        targetType: "consent_document",
        targetId: doc.id,
        detail: { purpose: "recipient_terms", version: doc.version },
      });
    }
    return { status: r.status as string, legacyId: r.legacy_id as string | null };
  });
  if (outcome.status === "accepted") return { legacyId: outcome.legacyId! };
  if (outcome.status === "terms_outdated") {
    throw new ValidationError("The recipient terms have been updated. Please read the current version.");
  }
  if (outcome.status === "email_mismatch") {
    throw new PolicyError("email_mismatch", "This invitation was sent to a different email address. Please sign in with that address.");
  }
  throw new NotFoundError("invitation");
}

// ------------------------------------------------------------------ read models

export interface RecipientView {
  id: string;
  displayName: string;
  relationship: string;
  isMinor: boolean;
  email: string | null;
  invitationStatus: "not_invited" | "invited" | "accepted" | "revoked";
  /** Always 0 in slice 1: nothing can be shared until the sharing slice exists (AC-02). */
  sharedItemCount: number;
}

export interface AuthorOverview {
  account: { id: string; email: string; displayName: string };
  consents: ConsentStatus[];
  legacy: null | {
    id: string;
    title: string;
    authorDisplayName: string;
    about: string | null;
    state: string;
    recipients: RecipientView[];
    trustedContacts: { id: string; displayName: string; email: string | null; relationship: string | null }[];
  };
  memberships: { legacyId: string; legacyTitle: string; authorDisplayName: string; acceptedAt: string }[];
}

export async function getOverview(ctx: AuthContext): Promise<AuthorOverview> {
  return withActor(ctx.accountId, async (db) => {
    const acc = (await db.query("select id, email, display_name from account where id = $1", [ctx.accountId])).rows[0];
    if (!acc) throw new NotFoundError("account");
    const consents = await consentStatuses(db, ctx);
    const l = (
      await db.query(
        "select id, title, author_display_name, about, state from legacy where owner_account_id = $1 order by created_at limit 1",
        [ctx.accountId],
      )
    ).rows[0];
    let legacy: AuthorOverview["legacy"] = null;
    if (l) {
      const recipients = (
        await db.query(
          "select id, display_name, relationship, is_minor, email, invitation_status from recipient where legacy_id = $1 order by created_at",
          [l.id],
        )
      ).rows.map((r) => ({
        id: r.id,
        displayName: r.display_name,
        relationship: r.relationship,
        isMinor: r.is_minor,
        email: r.email,
        invitationStatus: r.invitation_status,
        sharedItemCount: 0,
      }));
      const trustedContacts = (
        await db.query("select id, display_name, email, relationship from trusted_contact where legacy_id = $1 order by created_at", [l.id])
      ).rows.map((t) => ({ id: t.id, displayName: t.display_name, email: t.email, relationship: t.relationship }));
      legacy = { id: l.id, title: l.title, authorDisplayName: l.author_display_name, about: l.about, state: l.state, recipients, trustedContacts };
    }
    const memberships = (await db.query("select * from app.my_recipient_memberships()")).rows.map((m) => ({
      legacyId: m.legacy_id,
      legacyTitle: m.legacy_title,
      authorDisplayName: m.author_display_name,
      acceptedAt: new Date(m.accepted_at).toISOString(),
    }));
    return { account: { id: acc.id, email: acc.email, displayName: acc.display_name }, consents, legacy, memberships };
  });
}

export interface AuditEntry {
  id: string;
  occurredAt: string;
  action: string;
  outcome: string;
  targetType: string | null;
  byYou: boolean;
  detail: Record<string, unknown>;
}

/** The author-visible transparency log for their legacy (AC-13, slice-1 subset). */
export async function getAuditLog(ctx: AuthContext, legacyId: string, limit = 100): Promise<AuditEntry[]> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const { rows } = await db.query(
      `select id, occurred_at, action, outcome, target_type, actor_account_id, detail from audit_event
        where legacy_id = $1 or (legacy_id is null and actor_account_id = $2)
        order by occurred_at desc limit $3`,
      [legacyId, ctx.accountId, Math.min(Math.max(limit, 1), 500)],
    );
    return rows.map((r) => ({
      id: r.id,
      occurredAt: new Date(r.occurred_at).toISOString(),
      action: r.action,
      outcome: r.outcome,
      targetType: r.target_type,
      byYou: r.actor_account_id === ctx.accountId,
      detail: r.detail,
    }));
  });
}
