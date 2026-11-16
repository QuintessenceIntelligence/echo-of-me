/**
 * Vertical slice 1: author consent and onboarding.
 * Maps to 01D acceptance criteria AC-01, AC-02 and the slice-1 part of AC-13.
 */
import { describe, expect, it } from "vitest";
import { consentStatuses, giveConsent, withdrawConsent } from "../src/domain/consent";
import { ConsentRequiredError, MfaRequiredError, NotFoundError, PolicyError, ValidationError } from "../src/domain/errors";
import {
  acceptInvitation,
  addRecipient,
  addTrustedContact,
  completeOnboarding,
  createLegacy,
  getAuditLog,
  getOverview,
  inviteRecipient,
  removeRecipient,
  revokeInvitation,
} from "../src/domain/onboarding";
import { withActor } from "../src/server/db";
import { docIdFor, makePerson, rawAs, rawSystem, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();

async function authorWithLegacy(consents = ["terms_of_service", "privacy_notice", "share_with_recipients"] as const) {
  const author = await makePerson("author", [...consents]);
  const { legacyId } = await createLegacy(author, { title: "Letters for my children", authorDisplayName: "Dad" });
  return { author, legacyId };
}

describe("AC-01 · author creates a legacy, adds three recipients and records consents", () => {
  it("records each consent with its text version, text fingerprint and timestamp", async () => {
    const { author, legacyId } = await authorWithLegacy();
    await addRecipient(author, legacyId, { displayName: "Asha", relationship: "child", isMinor: false, email: "asha@example.test" });
    await addRecipient(author, legacyId, { displayName: "Ravi", relationship: "child", isMinor: true });
    await addRecipient(author, legacyId, { displayName: "Priya", relationship: "partner", isMinor: false });
    await completeOnboarding(author, legacyId);

    const o = await getOverview(author);
    expect(o.legacy?.state).toBe("active");
    expect(o.legacy?.recipients).toHaveLength(3);
    for (const p of ["terms_of_service", "privacy_notice", "share_with_recipients"]) {
      const c = o.consents.find((x) => x.purpose === p)!;
      expect(c.state).toBe("granted");
      expect(c.agreedVersion).toBe("0.1-draft");
      expect(c.agreedSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(Date.parse(c.recordedAt!)).not.toBeNaN();
    }
    expect(o.consents.find((x) => x.purpose === "ai_processing")!.state).toBe("never_given");
  });

  it("refuses to create a legacy before the required consents are given", async () => {
    const p = await makePerson("noconsent", []);
    await expect(createLegacy(p, { title: "T", authorDisplayName: "Me" })).rejects.toBeInstanceOf(ConsentRequiredError);
    const audit = await rawSystem(pool(), "select outcome, detail from audit_event where actor_account_id = $1 and action = 'legacy.create'", [p.accountId]);
    expect(audit).toEqual([{ outcome: "denied", detail: { reason: "consent_required" } }]);
  });

  it("rejects consent to a text version that is not the one currently published", async () => {
    const p = await makePerson("stale", []);
    const wrongDoc = await docIdFor("privacy_notice");
    await expect(giveConsent(p, { purpose: "terms_of_service", documentId: wrongDoc })).rejects.toBeInstanceOf(ValidationError);
  });

  it("validates input and keeps minors as records without email", async () => {
    const { author, legacyId } = await authorWithLegacy();
    await expect(addRecipient(author, legacyId, { displayName: " ", relationship: "child", isMinor: false })).rejects.toBeInstanceOf(ValidationError);
    await expect(
      addRecipient(author, legacyId, { displayName: "Kid", relationship: "child", isMinor: true, email: "kid@example.test" }),
    ).rejects.toBeInstanceOf(ValidationError);
    // Database constraint holds even if application validation were bypassed.
    await expect(
      rawAs(pool(), author.accountId, "insert into recipient (legacy_id, display_name, relationship, is_minor, invitation_status, email) values ($1,'K','child',true,'invited','k@example.test')", [legacyId]),
    ).rejects.toThrow(/minor_is_record_only/);
  });

  it("stores a trusted contact as a record only", async () => {
    const { author, legacyId } = await authorWithLegacy();
    await addTrustedContact(author, legacyId, { displayName: "Uncle Dev", relationship: "brother" });
    const o = await getOverview(author);
    expect(o.legacy?.trustedContacts.map((t) => t.displayName)).toEqual(["Uncle Dev"]);
  });
});

describe("AC-02 · adding or inviting a recipient grants no access", () => {
  it("an accepted recipient can see only the legacy title, nothing else", async () => {
    const { author, legacyId } = await authorWithLegacy();
    const recipient = await makePerson("recipient");
    const { recipientId } = await addRecipient(author, legacyId, { displayName: "Asha", relationship: "child", isMinor: false, email: recipient.email });
    await addRecipient(author, legacyId, { displayName: "Sibling", relationship: "child", isMinor: true });
    await addTrustedContact(author, legacyId, { displayName: "Uncle" });
    const { token } = await inviteRecipient(author, legacyId, recipientId);
    await acceptInvitation(recipient, token, await docIdFor("recipient_terms"));

    const o = await getOverview(recipient);
    expect(o.legacy).toBeNull();
    expect(o.memberships).toEqual([expect.objectContaining({ legacyId, legacyTitle: "Letters for my children", authorDisplayName: "Dad" })]);

    // Raw SQL as the recipient, bypassing every application check: row-level security returns nothing.
    for (const table of ["legacy", "recipient", "invitation", "trusted_contact"]) {
      expect(await rawAs(pool(), recipient.accountId, `select * from ${table}`)).toHaveLength(0);
    }
    expect(await rawAs(pool(), recipient.accountId, "select * from audit_event where legacy_id = $1 and actor_account_id <> $2", [legacyId, recipient.accountId])).toHaveLength(0);
    expect(await rawAs(pool(), recipient.accountId, "select * from consent_event where account_id = $1", [author.accountId])).toHaveLength(0);
    await expect(getAuditLog(recipient, legacyId)).rejects.toBeInstanceOf(NotFoundError);

    const authorView = await getOverview(author);
    const r = authorView.legacy!.recipients.find((x) => x.id === recipientId)!;
    expect(r.invitationStatus).toBe("accepted");
    expect(r.sharedItemCount).toBe(0);
  });
});

describe("Invitations · safeguards", () => {
  it("require a verified second factor, and the refusal is audited", async () => {
    const author = await makePerson("nomfa", ["terms_of_service", "privacy_notice", "share_with_recipients"], "aal1");
    const { legacyId } = await createLegacy(author, { title: "T", authorDisplayName: "Me" });
    const { recipientId } = await addRecipient(author, legacyId, { displayName: "A", relationship: "child", isMinor: false, email: "a1@example.test" });
    await expect(inviteRecipient(author, legacyId, recipientId)).rejects.toBeInstanceOf(MfaRequiredError);
    const log = await getAuditLog(author, legacyId);
    expect(log.find((e) => e.action === "invitation.create")).toMatchObject({ outcome: "denied", detail: { reason: "mfa_required" } });
  });

  it("require the share-with-recipients consent", async () => {
    const { author, legacyId } = await authorWithLegacy(["terms_of_service", "privacy_notice"] as never);
    const { recipientId } = await addRecipient(author, legacyId, { displayName: "A", relationship: "child", isMinor: false, email: "a2@example.test" });
    await expect(inviteRecipient(author, legacyId, recipientId)).rejects.toBeInstanceOf(ConsentRequiredError);
  });

  it("cannot be sent to a minor", async () => {
    const { author, legacyId } = await authorWithLegacy();
    const { recipientId } = await addRecipient(author, legacyId, { displayName: "Kid", relationship: "child", isMinor: true });
    await expect(inviteRecipient(author, legacyId, recipientId)).rejects.toMatchObject({ code: "minor_not_invitable" });
  });

  it("store only a hash of the token", async () => {
    const { author, legacyId } = await authorWithLegacy();
    const { recipientId } = await addRecipient(author, legacyId, { displayName: "A", relationship: "child", isMinor: false, email: "a3@example.test" });
    const { token, invitationId } = await inviteRecipient(author, legacyId, recipientId);
    const rows = await rawSystem<{ token_sha256: string }>(pool(), "select token_sha256 from invitation where id = $1", [invitationId]);
    expect(rows[0].token_sha256).not.toContain(token);
    expect(rows[0].token_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuse a different signed-in person, and record the refusal", async () => {
    const { author, legacyId } = await authorWithLegacy();
    const intended = await makePerson("intended");
    const intruder = await makePerson("intruder");
    const { recipientId } = await addRecipient(author, legacyId, { displayName: "A", relationship: "child", isMinor: false, email: intended.email });
    const { token } = await inviteRecipient(author, legacyId, recipientId);
    await expect(acceptInvitation(intruder, token, await docIdFor("recipient_terms"))).rejects.toBeInstanceOf(PolicyError);
    const log = await getAuditLog(author, legacyId);
    expect(log.find((e) => e.action === "invitation.accept")).toMatchObject({ outcome: "denied", byYou: false, detail: { reason: "email_mismatch" } });
    // The rightful person can still accept.
    await expect(acceptInvitation(intended, token, await docIdFor("recipient_terms"))).resolves.toMatchObject({ legacyId });
  });

  it("are single-use, expire, and are superseded by a new invitation", async () => {
    const { author, legacyId } = await authorWithLegacy();
    const r1 = await makePerson("r1");
    const terms = await docIdFor("recipient_terms");
    const { recipientId } = await addRecipient(author, legacyId, { displayName: "A", relationship: "child", isMinor: false, email: r1.email });
    const first = await inviteRecipient(author, legacyId, recipientId);
    const second = await inviteRecipient(author, legacyId, recipientId);
    await expect(acceptInvitation(r1, first.token, terms)).rejects.toBeInstanceOf(NotFoundError);
    await acceptInvitation(r1, second.token, terms);
    await expect(acceptInvitation(r1, second.token, terms)).rejects.toBeInstanceOf(NotFoundError);

    const r2 = await makePerson("r2");
    const rec2 = await addRecipient(author, legacyId, { displayName: "B", relationship: "child", isMinor: false, email: r2.email });
    const inv = await inviteRecipient(author, legacyId, rec2.recipientId);
    await rawSystem(pool(), "update invitation set expires_at = now() - interval '1 minute' where id = $1", [inv.invitationId]);
    await expect(acceptInvitation(r2, inv.token, terms)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("can be revoked by the author", async () => {
    const { author, legacyId } = await authorWithLegacy();
    const r = await makePerson("rv");
    const { recipientId } = await addRecipient(author, legacyId, { displayName: "A", relationship: "child", isMinor: false, email: r.email });
    const { token } = await inviteRecipient(author, legacyId, recipientId);
    await revokeInvitation(author, legacyId, recipientId);
    await expect(acceptInvitation(r, token, await docIdFor("recipient_terms"))).rejects.toBeInstanceOf(NotFoundError);
    expect((await getOverview(author)).legacy!.recipients[0].invitationStatus).toBe("revoked");
  });
});

describe("Consent withdrawal · versioned, revocable and propagated", () => {
  it("withdrawing sharing consent cancels pending invitations immediately", async () => {
    const { author, legacyId } = await authorWithLegacy();
    const r = await makePerson("pending");
    const { recipientId } = await addRecipient(author, legacyId, { displayName: "A", relationship: "child", isMinor: false, email: r.email });
    const { token } = await inviteRecipient(author, legacyId, recipientId);

    const { revokedInvitations } = await withdrawConsent(author, "share_with_recipients");
    expect(revokedInvitations).toBe(1);
    await expect(acceptInvitation(r, token, await docIdFor("recipient_terms"))).rejects.toBeInstanceOf(NotFoundError);
    await expect(inviteRecipient(author, legacyId, recipientId)).rejects.toBeInstanceOf(ConsentRequiredError);

    const statuses = await withActor(author.accountId, (db) => consentStatuses(db, author));
    expect(statuses.find((s) => s.purpose === "share_with_recipients")!.state).toBe("withdrawn");
    const log = await getAuditLog(author, legacyId);
    expect(log.some((e) => e.action === "invitation.revoke" && e.detail.reason === "consent_withdrawn")).toBe(true);
  });

  it("consent history is append-only, even for the database owner", async () => {
    const p = await makePerson("hist");
    await expect(rawAs(pool(), p.accountId, "update consent_event set action = 'withdrawn' where account_id = $1", [p.accountId])).rejects.toThrow();
    await expect(rawSystem(pool(), "delete from consent_event where account_id = $1", [p.accountId])).rejects.toThrow(/append_only/);
    await expect(rawSystem(pool(), "delete from audit_event where actor_account_id = $1", [p.accountId])).rejects.toThrow(/append_only/);
    await expect(rawSystem(pool(), "update consent_document set body = 'changed'")).rejects.toThrow(/append_only/);
  });
});

describe("AC-13 (slice-1 part) · audit log", () => {
  it("records onboarding actions without personal details", async () => {
    const { author, legacyId } = await authorWithLegacy();
    const r = await makePerson("aud");
    const { recipientId } = await addRecipient(author, legacyId, { displayName: "Secret Name", relationship: "child", isMinor: false, email: r.email });
    await inviteRecipient(author, legacyId, recipientId);
    await removeRecipient(author, legacyId, recipientId);

    const log = await getAuditLog(author, legacyId);
    const actions = log.map((e) => e.action);
    for (const a of ["consent.grant", "legacy.create", "recipient.add", "invitation.create", "recipient.remove"]) {
      expect(actions).toContain(a);
    }
    const raw = JSON.stringify(await rawSystem(pool(), "select detail from audit_event where legacy_id = $1", [legacyId]));
    expect(raw).not.toContain("Secret Name");
    expect(raw).not.toContain(r.email);
  });
});
