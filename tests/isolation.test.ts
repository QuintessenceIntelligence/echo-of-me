/**
 * Cross-legacy isolation (hard gate H5 / AC-08 foundation). Author B tries every slice-1 operation
 * on author A's legacy, through the application and through raw SQL as the application role.
 * Expected: 0 successes, every application-level attempt audited as denied.
 */
import { describe, expect, it } from "vitest";
import { NotFoundError } from "../src/domain/errors";
import {
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
import { makePerson, rawAs, rawSystem, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();
const ALL = ["terms_of_service", "privacy_notice", "share_with_recipients"] as const;

async function twoFamilies() {
  const a = await makePerson("familyA", [...ALL]);
  const b = await makePerson("familyB", [...ALL]);
  const { legacyId: legacyA } = await createLegacy(a, { title: "A's legacy", authorDisplayName: "A" });
  const { legacyId: legacyB } = await createLegacy(b, { title: "B's legacy", authorDisplayName: "B" });
  const { recipientId: recipientA } = await addRecipient(a, legacyA, { displayName: "A-child", relationship: "child", isMinor: false, email: "achild@example.test" });
  await inviteRecipient(a, legacyA, recipientA);
  await addTrustedContact(a, legacyA, { displayName: "A-trusted" });
  return { a, b, legacyA, legacyB, recipientA };
}

describe("Isolation through the application", () => {
  it("every operation on another family's legacy is refused as 'not found' and audited", async () => {
    const { b, legacyA, recipientA } = await twoFamilies();
    const attempts: [string, () => Promise<unknown>][] = [
      ["recipient.add", () => addRecipient(b, legacyA, { displayName: "x", relationship: "other", isMinor: false })],
      ["recipient.remove", () => removeRecipient(b, legacyA, recipientA)],
      ["trusted_contact.add", () => addTrustedContact(b, legacyA, { displayName: "x" })],
      ["invitation.create", () => inviteRecipient(b, legacyA, recipientA)],
      ["invitation.revoke", () => revokeInvitation(b, legacyA, recipientA)],
      ["legacy.activate", () => completeOnboarding(b, legacyA)],
      ["audit.read", () => getAuditLog(b, legacyA)],
    ];
    for (const [, attempt] of attempts) {
      await expect(attempt()).rejects.toBeInstanceOf(NotFoundError);
    }
    // B's own legacy id + A's recipient id: still refused.
    const { legacyB } = await (async () => ({ legacyB: (await getOverview(b)).legacy!.id }))();
    await expect(removeRecipient(b, legacyB, recipientA)).rejects.toBeInstanceOf(NotFoundError);
    await expect(inviteRecipient(b, legacyB, recipientA)).rejects.toBeInstanceOf(NotFoundError);

    const denied = await rawSystem<{ action: string }>(pool(), "select action from audit_event where actor_account_id = $1 and outcome = 'denied'", [b.accountId]);
    expect(denied.map((d) => d.action).sort()).toEqual(
      ["invitation.create", "invitation.create", "invitation.revoke", "legacy.activate", "recipient.add", "recipient.remove", "recipient.remove", "trusted_contact.add"].sort(),
    );
    expect((await getOverview(b)).legacy!.recipients).toHaveLength(0);
  });

  it("malformed identifiers are refused without errors leaking detail", async () => {
    const { b } = await twoFamilies();
    await expect(addRecipient(b, "not-a-uuid", { displayName: "x", relationship: "other", isMinor: false })).rejects.toBeInstanceOf(NotFoundError);
    await expect(addRecipient(b, "' or 1=1 --", { displayName: "x", relationship: "other", isMinor: false })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("Isolation in the database (raw SQL as the application role, no application checks)", () => {
  it("another family's rows are invisible and cannot be written", async () => {
    const { a, b, legacyA, recipientA } = await twoFamilies();
    for (const table of ["legacy", "recipient", "invitation", "trusted_contact"]) {
      const rows = await rawAs<{ legacy_id?: string; id: string }>(pool(), b.accountId, `select * from ${table}`);
      expect(rows.every((r) => (r.legacy_id ?? r.id) !== legacyA)).toBe(true);
    }
    expect(await rawAs(pool(), b.accountId, "select * from account where id = $1", [a.accountId])).toHaveLength(0);
    expect(await rawAs(pool(), b.accountId, "select * from consent_event where account_id = $1", [a.accountId])).toHaveLength(0);
    expect(await rawAs(pool(), b.accountId, "select * from audit_event where legacy_id = $1", [legacyA])).toHaveLength(0);

    await expect(
      rawAs(pool(), b.accountId, "insert into recipient (legacy_id, display_name, relationship, is_minor) values ($1,'x','other',false)", [legacyA]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      rawAs(pool(), b.accountId, "insert into legacy (owner_account_id, title, author_display_name) values ($1,'spoof','x')", [a.accountId]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      rawAs(pool(), b.accountId, "insert into consent_event (account_id, purpose, consent_document_id, action) select $1, purpose, id, 'withdrawn' from consent_document where purpose = 'terms_of_service'", [a.accountId]),
    ).rejects.toThrow(/row-level security/);
    // Updates and deletes silently match nothing.
    expect(await rawAs(pool(), b.accountId, "update recipient set display_name = 'hacked' where id = $1 returning id", [recipientA])).toHaveLength(0);
    expect(await rawAs(pool(), b.accountId, "delete from legacy where id = $1 returning id", [legacyA])).toHaveLength(0);
    expect(await rawAs(pool(), b.accountId, "update legacy set owner_account_id = $1 where id = $2 returning id", [b.accountId, legacyA])).toHaveLength(0);
  });

  it("the owner cannot hand their legacy to someone else by rewriting the owner column", async () => {
    const { a, b, legacyA } = await twoFamilies();
    await expect(
      rawAs(pool(), a.accountId, "update legacy set owner_account_id = $1 where id = $2", [b.accountId, legacyA]),
    ).rejects.toThrow(/row-level security/);
  });

  it("with no signed-in account, nothing is visible", async () => {
    await twoFamilies();
    for (const table of ["account", "legacy", "recipient", "invitation", "trusted_contact", "consent_event", "audit_event"]) {
      expect(await rawAs(pool(), null, `select * from ${table}`)).toHaveLength(0);
    }
  });

  it("the application role cannot bypass row-level security or alter the schema", async () => {
    const { b } = await twoFamilies();
    await expect(rawAs(pool(), b.accountId, "set local row_security = off; select * from legacy")).rejects.toThrow();
    await expect(rawAs(pool(), b.accountId, "alter table legacy disable row level security")).rejects.toThrow();
    await expect(rawAs(pool(), b.accountId, "insert into account (auth_subject, email, display_name) values ('x','x@example.test','x')")).rejects.toThrow();
  });
});
