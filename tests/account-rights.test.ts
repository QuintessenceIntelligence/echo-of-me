/**
 * Personal-data rights for every account (ADR-013, migration 0014): leave a legacy, download your own
 * data, close your account. Also: a closed or unknown account can do nothing at all.
 */
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { closeAccount, exportMyData, getAccount, leaveLegacy } from "../src/domain/account";
import { AccountUnavailableError, MfaRequiredError, NotFoundError, ValidationError } from "../src/domain/errors";
import { deleteLegacy } from "../src/domain/deletion";
import {
  acceptInvitation,
  addRecipient,
  completeOnboarding,
  createLegacy,
  getAuditLog,
  getOverview,
  inviteRecipient,
  provisionAccount,
} from "../src/domain/onboarding";
import { recipientAsk } from "../src/domain/rehearsal";
import { getItemSharing, listSharedItems, myMemberships, reportAnswer, setItemShares } from "../src/domain/sharing";
import { createMemory } from "../src/domain/vault";
import { withActor } from "../src/server/db";
import { useTempBlobStore } from "./fixtures";
import { docIdFor, makePerson, rawAs, rawSystem, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();
useTempBlobStore();
const AUTHOR = ["terms_of_service", "privacy_notice", "audio_recording", "ai_processing", "share_with_recipients"] as const;

async function family(label: string) {
  const a = await makePerson(`${label}Author`, [...AUTHOR]);
  const { legacyId } = await createLegacy(a, { title: `${label} legacy`, authorDisplayName: "Dad" });
  await completeOnboarding(a, legacyId);
  const son = await makePerson(`${label}Son`);
  const { recipientId } = await addRecipient(a, legacyId, { displayName: "Son", relationship: "child", isMinor: false, email: son.email });
  const { token } = await inviteRecipient(a, legacyId, recipientId);
  await acceptInvitation(son, token, await docIdFor("recipient_terms"));
  const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Saving money", body: "Save a tenth of every pay cheque.", approve: true });
  await setItemShares(a, legacyId, memoryId, [recipientId]);
  return { a, legacyId, son, recipientId, memoryId };
}

describe("A recipient leaves a legacy", () => {
  it("ends access at once, unshares, deletes their questions and reports, and tells the author", async () => {
    const f = await family("leave");
    const ans = await recipientAsk(f.son, f.legacyId, "How should I save money?");
    expect(ans.kind).toBe("grounded");
    await reportAnswer(f.son, f.legacyId, ans.turnId!, { reason: "other", note: "Just testing" });
    expect((await listSharedItems(f.son, f.legacyId)).items).toHaveLength(1);

    await leaveLegacy(f.son, f.legacyId);

    await expect(listSharedItems(f.son, f.legacyId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(recipientAsk(f.son, f.legacyId, "How should I save money?")).rejects.toBeInstanceOf(NotFoundError);
    expect(await myMemberships(f.son)).toHaveLength(0);
    const counts = await rawSystem<{ grants: number; turns: number; reports: number }>(
      pool(),
      `select (select count(*)::int from share_grant where legacy_id = $1) as grants,
              (select count(*)::int from recipient_turn where legacy_id = $1) as turns,
              (select count(*)::int from answer_report where legacy_id = $1) as reports`,
      [f.legacyId],
    );
    expect(counts[0]).toEqual({ grants: 0, turns: 0, reports: 0 });

    const o = await getOverview(f.a);
    expect(o.legacy!.recipients.find((r) => r.id === f.recipientId)?.invitationStatus).toBe("left");
    const sharing = await getItemSharing(f.a, f.legacyId, f.memoryId);
    expect(sharing.targets.find((t) => t.recipientId === f.recipientId)).toMatchObject({ shared: false });
    expect((await getAuditLog(f.a, f.legacyId)).some((e) => e.action === "membership.leave" && e.outcome === "success")).toBe(true);
    // Sharing with someone who left is refused until they are invited again.
    await expect(setItemShares(f.a, f.legacyId, f.memoryId, [f.recipientId])).rejects.toThrow(/left your legacy/);
  });

  it("the author can invite them again; they rejoin with nothing shared", async () => {
    const f = await family("rejoin");
    await leaveLegacy(f.son, f.legacyId);
    const { token } = await inviteRecipient(f.a, f.legacyId, f.recipientId);
    await acceptInvitation(f.son, token, await docIdFor("recipient_terms"));
    expect((await listSharedItems(f.son, f.legacyId)).items).toHaveLength(0);
  });

  it("cannot be used on a legacy you have not joined (including your own)", async () => {
    const f = await family("leaveNot");
    const stranger = await makePerson("leaveStranger");
    await expect(leaveLegacy(stranger, f.legacyId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(leaveLegacy(f.a, f.legacyId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(leaveLegacy(f.son, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
    expect((await listSharedItems(f.son, f.legacyId)).items).toHaveLength(1);
  });
});

describe("Download your own data", () => {
  it("includes the account's own data and not the author's content; needs the second factor", async () => {
    const f = await family("mydata");
    await recipientAsk(f.son, f.legacyId, "How should I save money?");
    const { json, filename } = await exportMyData(f.son);
    expect(filename).toMatch(/^echo-of-me-my-data-\d{4}-\d{2}-\d{2}\.json$/);
    const d = JSON.parse(json);
    expect(d.format).toBe("echo-of-me-account-data/0.1");
    expect(d.account.email).toBe(f.son.email.toLowerCase());
    expect(d.consents.map((c: { purpose: string }) => c.purpose)).toEqual(expect.arrayContaining(["terms_of_service", "recipient_terms"]));
    expect(d.memberships).toHaveLength(1);
    expect(d.questions_you_asked.map((q: { question: string }) => q.question)).toEqual(["How should I save money?"]);
    expect(json).not.toContain("Save a tenth of every pay cheque");
    await expect(exportMyData({ accountId: f.son.accountId, aal: "aal1" })).rejects.toBeInstanceOf(MfaRequiredError);
  });
});

describe("Close your account", () => {
  it("is refused for an author until their legacy is deleted, and needs the exact email and the second factor", async () => {
    const f = await family("closeAuthor");
    await expect(closeAccount(f.a, f.a.email)).rejects.toMatchObject({ code: "owns_legacy" });
    await expect(closeAccount({ accountId: f.a.accountId, aal: "aal1" }, f.a.email)).rejects.toBeInstanceOf(MfaRequiredError);
    await deleteLegacy(f.a, f.legacyId, "closeAuthor legacy");
    await expect(closeAccount(f.a, "someone@else.test")).rejects.toBeInstanceOf(ValidationError);
    await expect(closeAccount(f.a, `  ${f.a.email.toUpperCase()} `)).resolves.toEqual({ membershipsLeft: 0 });
  });

  it("leaves every legacy, deletes their questions, anonymises the account, keeps consent history, and locks it", async () => {
    const f = await family("close");
    await recipientAsk(f.son, f.legacyId, "How should I save money?");
    const consentsBefore = await rawSystem<{ n: number }>(pool(), "select count(*)::int as n from consent_event where account_id = $1", [f.son.accountId]);

    await expect(closeAccount(f.son, f.son.email)).resolves.toEqual({ membershipsLeft: 1 });

    const acct = (await rawSystem<{ email: string; display_name: string; auth_subject: string; closed_at: Date | null }>(
      pool(), "select email, display_name, auth_subject, closed_at from account where id = $1", [f.son.accountId]))[0];
    expect(acct.closed_at).not.toBeNull();
    expect(acct.display_name).toBe("Closed account");
    expect(acct.email).toBe(`closed-${f.son.accountId}@closed.invalid`);
    expect(acct.auth_subject).toBe(`closed|${f.son.accountId}`);
    const consentsAfter = await rawSystem<{ n: number }>(pool(), "select count(*)::int as n from consent_event where account_id = $1", [f.son.accountId]);
    expect(consentsAfter[0].n).toBe(consentsBefore[0].n);
    const turns = await rawSystem<{ n: number }>(pool(), "select count(*)::int as n from recipient_turn where asked_by = $1", [f.son.accountId]);
    expect(turns[0].n).toBe(0);
    // The author sees that they left; nothing names them in the activity detail.
    const log = await getAuditLog(f.a, f.legacyId);
    const leave = log.find((e) => e.action === "membership.leave");
    expect(leave?.detail).toMatchObject({ reason: "account_closed" });
    expect(JSON.stringify(log).toLowerCase()).not.toContain(f.son.email.toLowerCase());
    expect((await getOverview(f.a)).legacy!.recipients.find((r) => r.id === f.recipientId)?.invitationStatus).toBe("left");

    // The closed account can do nothing, through any path.
    await expect(getAccount(f.son)).rejects.toBeInstanceOf(AccountUnavailableError);
    await expect(myMemberships(f.son)).rejects.toBeInstanceOf(AccountUnavailableError);
    await expect(listSharedItems(f.son, f.legacyId)).rejects.toBeInstanceOf(AccountUnavailableError);
    await expect(closeAccount(f.son, f.son.email)).rejects.toBeInstanceOf(AccountUnavailableError);

    // The same email address can sign up again, as a new person.
    const again = await provisionAccount({ authSubject: `test|${f.son.email}`, email: f.son.email, displayName: "Son again" });
    expect(again.created).toBe(true);
    expect(again.accountId).not.toBe(f.son.accountId);
  });

  it("unknown accounts are refused, and the application role cannot change accounts or close someone else's", async () => {
    await expect(withActor(randomUUID(), async () => 1)).rejects.toBeInstanceOf(AccountUnavailableError);
    const x = await makePerson("closeRawX");
    const y = await makePerson("closeRawY");
    await expect(rawAs(pool(), x.accountId, "update account set display_name = 'Hacked' where id = $1", [x.accountId])).rejects.toThrow(/permission denied/);
    await expect(rawAs(pool(), x.accountId, "update account set closed_at = now() where id = $1", [y.accountId])).rejects.toThrow(/permission denied/);
    // close_my_account only ever acts on the caller (rolled back by rawAs).
    await rawAs(pool(), x.accountId, "select app.close_my_account()");
    const rows = await rawSystem<{ id: string; closed_at: Date | null }>(pool(), "select id, closed_at from account where id = any($1::uuid[])", [[x.accountId, y.accountId]]);
    expect(rows.every((r) => r.closed_at === null)).toBe(true);
    await expect(rawAs(pool(), null, "select app.close_my_account()")).rejects.toThrow(/no account/);
    await expect(rawAs(pool(), null, "select app.leave_legacy($1)", [randomUUID()])).rejects.toThrow(/no account/);
    await expect(rawAs(pool(), x.accountId, "select app.set_actor($1)", [randomUUID()])).rejects.toThrow(/account_unavailable/);
  });
});
