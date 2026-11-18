/**
 * Slice 5: sharing with adult recipients and recipient questions (ADR-009).
 * AC-02 (nothing until shared), AC-08 (no access to unshared or other legacies' items), AC-09/AC-10 for
 * recipients, AC-13 (access and answers logged for the author), and immediate revocation.
 */
import { describe, expect, it } from "vitest";
import { withdrawConsent } from "../src/domain/consent";
import { ConsentRequiredError, MfaRequiredError, NotFoundError, PolicyError, ValidationError } from "../src/domain/errors";
import { acceptInvitation, addRecipient, completeOnboarding, createLegacy, getAuditLog, inviteRecipient, removeRecipient } from "../src/domain/onboarding";
import { pinAnswer, recipientAsk, rehearse, suppressForQuestion } from "../src/domain/rehearsal";
import {
  getItemSharing,
  listReports,
  listSharedItems,
  myMemberships,
  reportAnswer,
  resolveReport,
  setItemShares,
  stopSharingWith,
} from "../src/domain/sharing";
import { addMedia, addTag, createMemory, editMemory, readMedia, saveTranscript, setMemoryApproval, setSensitivity } from "../src/domain/vault";
import { useTempBlobStore, wav } from "./fixtures";
import { docIdFor, makePerson, rawAs, rawSystem, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();
useTempBlobStore();
const AUTHOR = ["terms_of_service", "privacy_notice", "audio_recording", "ai_processing", "share_with_recipients"] as const;

async function joined(a: Awaited<ReturnType<typeof makePerson>>, legacyId: string, name: string) {
  const person = await makePerson(name);
  const { recipientId } = await addRecipient(a, legacyId, { displayName: name, relationship: "child", isMinor: false, email: person.email });
  const { token } = await inviteRecipient(a, legacyId, recipientId);
  await acceptInvitation(person, token, await docIdFor("recipient_terms"));
  return { person, recipientId };
}

async function family(label = "share") {
  const a = await makePerson(`${label}Author`, [...AUTHOR]);
  const { legacyId } = await createLegacy(a, { title: "For my children", authorDisplayName: "Dad" });
  await completeOnboarding(a, legacyId);
  const son = await joined(a, legacyId, `${label}Son`);
  const daughter = await joined(a, legacyId, `${label}Daughter`);
  const { recipientId: minor } = await addRecipient(a, legacyId, { displayName: "Little one", relationship: "child", isMinor: true });
  const pendingPerson = await makePerson(`${label}Pending`);
  const { recipientId: pending } = await addRecipient(a, legacyId, { displayName: "Pending", relationship: "friend", isMinor: false, email: pendingPerson.email });
  const { token: pendingToken } = await inviteRecipient(a, legacyId, pending);
  const add = async (title: string, body: string, approve = true) => (await createMemory(a, legacyId, { kind: "memory", title, body, approve })).memoryId;
  const m = {
    money: await add("Saving money", "Save a tenth of every pay cheque before you spend anything."),
    driving: await add("My driving test", "I failed my driving test twice and passed the third time."),
    secretDraft: await add("Money secrets draft", "Draft words about money that nobody should see.", false),
    honesty: await add("Honesty", "Tell the truth, even when it costs you."),
  };
  return { a, legacyId, son, daughter, minor, pending, pendingPerson, pendingToken, m };
}

const titles = (s: Awaited<ReturnType<typeof listSharedItems>>) => s.items.map((i) => i.title);

describe("Nothing is visible until the author shares (AC-02)", () => {
  it("an accepted recipient sees no items and cannot ask before anything is shared", async () => {
    const f = await family();
    expect((await listSharedItems(f.son.person, f.legacyId)).items).toEqual([]);
    const ans = await recipientAsk(f.son.person, f.legacyId, "How should I save money?");
    expect(ans.kind).toBe("not_recorded");
    expect(JSON.stringify(ans)).not.toContain("tenth");
    expect((await myMemberships(f.son.person))[0]).toMatchObject({ legacyId: f.legacyId, sharedCount: 0 });
  });
});

describe("Sharing exposes exactly the shared, approved, current material", () => {
  it("the recipient sees the shared item's current approved words, its original and approved transcript, nothing else", async () => {
    const f = await family();
    const { assetId } = await addMedia(f.a, f.legacyId, f.m.money, { bytes: wav(), capture: "upload" });
    await saveTranscript(f.a, f.legacyId, assetId, { text: "Save a tenth first.", expectedVersion: 0, approve: true });
    await editMemory(f.a, f.legacyId, f.m.money, { expectedVersion: 1, title: "Saving money", body: "Save a tenth of every pay cheque before you spend anything. Always.", approve: true });
    await addTag(f.a, f.legacyId, f.m.money, { kind: "person", label: "Grandma" });
    await setItemShares(f.a, f.legacyId, f.m.money, [f.son.recipientId]);

    const shared = await listSharedItems(f.son.person, f.legacyId);
    expect(titles(shared)).toEqual(["Saving money"]);
    expect(shared.items[0].body).toBe("Save a tenth of every pay cheque before you spend anything. Always.");
    expect(shared.items[0].media).toEqual([{ id: assetId, kind: "audio", transcript: "Save a tenth first." }]);
    expect(Buffer.compare((await readMedia(f.son.person, assetId)).bytes, wav())).toBe(0);
    // Not shared with the daughter.
    expect(titles(await listSharedItems(f.daughter.person, f.legacyId))).toEqual([]);
    await expect(readMedia(f.daughter.person, assetId)).rejects.toBeInstanceOf(NotFoundError);
    // Raw SQL as the son: only the current version, no tags, audience, rules, grants or practice history.
    expect(await rawAs(pool(), f.son.person.accountId, "select version_no from memory_version where memory_id = $1", [f.m.money])).toEqual([{ version_no: 2 }]);
    for (const t of ["memory_tag", "memory_audience", "answer_rule", "share_grant", "rehearsal_turn"]) {
      expect(await rawAs(pool(), f.son.person.accountId, `select * from ${t} where legacy_id = $1`, [f.legacyId])).toHaveLength(0);
    }
    expect((await rawAs<{ memory_id: string }>(pool(), f.son.person.accountId, "select distinct memory_id from citable_source where legacy_id = $1", [f.legacyId])).map((r) => r.memory_id)).toEqual([f.m.money]);
    const log = await getAuditLog(f.a, f.legacyId);
    expect(log.map((e) => e.action)).toEqual(expect.arrayContaining(["share.grant", "shared.view", "shared.media_play"]));
  });

  it("an unapproved transcript of a shared item stays hidden", async () => {
    const f = await family();
    const { assetId } = await addMedia(f.a, f.legacyId, f.m.honesty, { bytes: wav(), capture: "upload" });
    await setMemoryApproval(f.a, f.legacyId, f.m.honesty, true, 1);
    await saveTranscript(f.a, f.legacyId, assetId, { text: "UNAPPROVED transcript words", expectedVersion: 0 });
    await setItemShares(f.a, f.legacyId, f.m.honesty, [f.son.recipientId]);
    const shared = await listSharedItems(f.son.person, f.legacyId);
    expect(shared.items[0].media[0].transcript).toBeNull();
    expect(await rawAs(pool(), f.son.person.accountId, "select * from transcript_version where media_asset_id = $1", [assetId])).toHaveLength(0);
  });
});

describe("Recipient questions use only what was shared with them", () => {
  it("answers from shared items, never from unshared approved items or drafts; identity and safety work the same", async () => {
    const f = await family();
    await setItemShares(f.a, f.legacyId, f.m.driving, [f.son.recipientId]);
    const direct = await recipientAsk(f.son.person, f.legacyId, "What happened with your driving test?");
    expect(direct).toMatchObject({ kind: "grounded", evidence: "E1", teachable: false });
    expect(direct.passages[0].quote).toBe("I failed my driving test twice and passed the third time.");
    expect(direct.disclosure).toContain("It is not Dad");
    // Approved but not shared → not used; draft → never.
    const money = await recipientAsk(f.son.person, f.legacyId, "How should I save money?");
    expect(money.kind).toBe("not_recorded");
    expect(JSON.stringify(money)).not.toMatch(/tenth|Draft words/);
    expect(money.adjacent.map((x) => x.title)).toEqual(["My driving test"]);
    expect((await recipientAsk(f.son.person, f.legacyId, "Are you really my dad?")).kind).toBe("identity");
    const crisis = await recipientAsk(f.son.person, f.legacyId, "I don't want to live without you");
    expect(crisis.kind).toBe("safety");
    expect(crisis.resources.length).toBeGreaterThan(0);
  });

  it("questions are private to the recipient; the author's log shows only that an answer was given and from which items", async () => {
    const f = await family();
    await setItemShares(f.a, f.legacyId, f.m.driving, [f.son.recipientId]);
    const ans = await recipientAsk(f.son.person, f.legacyId, "What happened with your driving test?");
    expect(await rawAs(pool(), f.a.accountId, "select * from recipient_turn where legacy_id = $1", [f.legacyId])).toHaveLength(0);
    expect(await rawAs(pool(), f.daughter.person.accountId, "select * from recipient_turn where legacy_id = $1", [f.legacyId])).toHaveLength(0);
    const ev = (await getAuditLog(f.a, f.legacyId)).find((e) => e.action === "answer.recipient")!;
    expect(ev.detail).toMatchObject({ kind: "grounded", evidence: "E1" });
    expect(String(ev.detail.source_ids)).toBe(ans.passages[0].sourceId);
    expect(JSON.stringify(ev)).not.toContain("driving test?");
    const safety = await recipientAsk(f.son.person, f.legacyId, "I want to die");
    expect((await rawSystem<{ question: string | null }>(pool(), "select question from recipient_turn where id = $1", [safety.turnId]))[0].question).toBeNull();
  });

  it("the author's pins and suppressions apply, but a pin on an item not shared with this recipient is inactive", async () => {
    const f = await family();
    await setItemShares(f.a, f.legacyId, f.m.driving, [f.son.recipientId]);
    await setItemShares(f.a, f.legacyId, f.m.honesty, [f.son.recipientId]);
    const q1 = await rehearse(f.a, f.legacyId, "What should I do when I fail?");
    await pinAnswer(f.a, f.legacyId, q1.turnId, f.m.honesty);
    const pinned = await recipientAsk(f.son.person, f.legacyId, "What should I do when I fail?");
    expect(pinned.passages.map((p) => p.memoryId)).toEqual([f.m.honesty]);
    expect(pinned.rules.pinnedAt).not.toBeNull();
    const q2 = await rehearse(f.a, f.legacyId, "How should I save money?");
    await pinAnswer(f.a, f.legacyId, q2.turnId, f.m.money); // money is not shared with the son
    const unshared = await recipientAsk(f.son.person, f.legacyId, "How should I save money?");
    expect(unshared.rules.pinnedAt).toBeNull();
    expect(JSON.stringify(unshared)).not.toContain("tenth");
    const q3 = await rehearse(f.a, f.legacyId, "Tell me about the driving test");
    await suppressForQuestion(f.a, f.legacyId, q3.turnId, f.m.driving);
    expect((await recipientAsk(f.son.person, f.legacyId, "Tell me about the driving test")).passages).toEqual([]);
  });

  it("needs the author's AI-processing consent to answer; reading shared items still works", async () => {
    const f = await family();
    await setItemShares(f.a, f.legacyId, f.m.driving, [f.son.recipientId]);
    await withdrawConsent(f.a, "ai_processing");
    await expect(recipientAsk(f.son.person, f.legacyId, "What happened with your driving test?")).rejects.toBeInstanceOf(PolicyError);
    const shared = await listSharedItems(f.son.person, f.legacyId);
    expect(shared.answersOn).toBe(false);
    expect(titles(shared)).toEqual(["My driving test"]);
  });
});

describe("Access ends immediately", () => {
  it("when the item returns to draft (and returns when re-approved)", async () => {
    const f = await family();
    await setItemShares(f.a, f.legacyId, f.m.money, [f.son.recipientId]);
    await editMemory(f.a, f.legacyId, f.m.money, { expectedVersion: 1, title: "Saving money", body: "Rewriting this, not ready." });
    expect(titles(await listSharedItems(f.son.person, f.legacyId))).toEqual([]);
    expect(JSON.stringify(await recipientAsk(f.son.person, f.legacyId, "How should I save money?"))).not.toMatch(/Rewriting|tenth/);
    await setMemoryApproval(f.a, f.legacyId, f.m.money, true, 2);
    expect((await listSharedItems(f.son.person, f.legacyId)).items[0].body).toBe("Rewriting this, not ready.");
  });

  it("when the author stops sharing, stops sharing everything with that person, removes them, or withdraws the sharing consent", async () => {
    const f = await family();
    await setItemShares(f.a, f.legacyId, f.m.money, [f.son.recipientId, f.daughter.recipientId]);
    await setItemShares(f.a, f.legacyId, f.m.money, [f.son.recipientId]);
    expect(titles(await listSharedItems(f.daughter.person, f.legacyId))).toEqual([]);
    expect(await stopSharingWith(f.a, f.legacyId, f.son.recipientId)).toEqual({ removed: 1 });
    expect(titles(await listSharedItems(f.son.person, f.legacyId))).toEqual([]);

    await setItemShares(f.a, f.legacyId, f.m.money, [f.son.recipientId, f.daughter.recipientId]);
    await removeRecipient(f.a, f.legacyId, f.daughter.recipientId);
    await expect(listSharedItems(f.daughter.person, f.legacyId)).rejects.toBeInstanceOf(NotFoundError);

    await withdrawConsent(f.a, "share_with_recipients");
    expect(titles(await listSharedItems(f.son.person, f.legacyId))).toEqual([]);
    expect(await rawSystem(pool(), "select * from share_grant where legacy_id = $1", [f.legacyId])).toHaveLength(0);
    expect((await getAuditLog(f.a, f.legacyId)).map((e) => e.action)).toContain("share.revoke_all");
  });

  it("when the legacy is no longer active", async () => {
    const f = await family();
    await setItemShares(f.a, f.legacyId, f.m.money, [f.son.recipientId]);
    await rawSystem(pool(), "update legacy set state = 'frozen' where id = $1", [f.legacyId]);
    await expect(listSharedItems(f.son.person, f.legacyId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(recipientAsk(f.son.person, f.legacyId, "money")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("Sharing rules for the author", () => {
  it("needs a second factor, the sharing consent, an approved item, and confirmation for sensitive items", async () => {
    const f = await family();
    await expect(setItemShares({ accountId: f.a.accountId, aal: "aal1" }, f.legacyId, f.m.money, [f.son.recipientId])).rejects.toBeInstanceOf(MfaRequiredError);
    await expect(setItemShares(f.a, f.legacyId, f.m.secretDraft, [f.son.recipientId])).rejects.toBeInstanceOf(ValidationError);
    await setSensitivity(f.a, f.legacyId, f.m.honesty, "sensitive");
    await expect(setItemShares(f.a, f.legacyId, f.m.honesty, [f.son.recipientId])).rejects.toThrow(/sensitive/);
    await setItemShares(f.a, f.legacyId, f.m.honesty, [f.son.recipientId], { confirmSensitive: true });
    expect(titles(await listSharedItems(f.son.person, f.legacyId))).toEqual(["Honesty"]);
    const b = await makePerson("noShareConsent", ["terms_of_service", "privacy_notice"]);
    const { legacyId: lb } = await createLegacy(b, { title: "B", authorDisplayName: "B" });
    await completeOnboarding(b, lb);
    const { memoryId } = await createMemory(b, lb, { kind: "memory", title: "x", body: "y", approve: true });
    const { recipientId } = await addRecipient(b, lb, { displayName: "R", relationship: "friend", isMinor: false, email: "r@example.test" });
    await expect(setItemShares(b, lb, memoryId, [recipientId])).rejects.toBeInstanceOf(ConsentRequiredError);
  });

  it("refuses children, people never invited, revoked invitations and other legacies' recipients", async () => {
    const f = await family();
    const { recipientId: notInvited } = await addRecipient(f.a, f.legacyId, { displayName: "Not invited", relationship: "friend", isMinor: false, email: "ni@example.test" });
    await expect(setItemShares(f.a, f.legacyId, f.m.money, [f.minor])).rejects.toThrow(/Children/);
    await expect(setItemShares(f.a, f.legacyId, f.m.money, [notInvited])).rejects.toThrow(/Invite/);
    const other = await family("other");
    await expect(setItemShares(f.a, f.legacyId, f.m.money, [other.son.recipientId])).rejects.toBeInstanceOf(NotFoundError);
    await expect(setItemShares(f.a, f.legacyId, other.m.money, [f.son.recipientId])).rejects.toBeInstanceOf(NotFoundError);
    const sharing = await getItemSharing(f.a, f.legacyId, f.m.money);
    expect(sharing.targets.find((t) => t.recipientId === f.minor)?.eligibility).toBe("minor");
    expect(sharing.targets.find((t) => t.recipientId === notInvited)?.eligibility).toBe("not_invited");
  });

  it("an invited person can be shared with in advance; they see it once they accept", async () => {
    const f = await family();
    await setItemShares(f.a, f.legacyId, f.m.money, [f.pending]);
    await expect(listSharedItems(f.pendingPerson, f.legacyId)).rejects.toBeInstanceOf(NotFoundError);
    await acceptInvitation(f.pendingPerson, f.pendingToken, await docIdFor("recipient_terms"));
    expect(titles(await listSharedItems(f.pendingPerson, f.legacyId))).toEqual(["Saving money"]);
  });
});

describe("Isolation (AC-08)", () => {
  it("recipients and other families cannot reach unshared content by any route", async () => {
    const f = await family("isoA");
    const g = await family("isoB");
    await setItemShares(f.a, f.legacyId, f.m.money, [f.son.recipientId]);
    await expect(listSharedItems(g.son.person, f.legacyId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(recipientAsk(g.son.person, f.legacyId, "money")).rejects.toBeInstanceOf(NotFoundError);
    await expect(recipientAsk(g.a, f.legacyId, "money")).rejects.toBeInstanceOf(NotFoundError);
    await expect(listSharedItems(f.son.person, g.legacyId)).rejects.toBeInstanceOf(NotFoundError);
    // The recipient cannot grant themselves access or read grants.
    await expect(rawAs(pool(), f.son.person.accountId, "insert into share_grant (memory_id, recipient_id, legacy_id, granted_by) values ($1, $2, $3, $4)", [f.m.driving, f.son.recipientId, f.legacyId, f.son.person.accountId])).rejects.toThrow(/row-level security/);
    expect(await rawAs(pool(), f.son.person.accountId, "select * from memory_item where id = $1", [f.m.driving])).toHaveLength(0);
    expect(await rawAs(pool(), f.son.person.accountId, "select * from app.search_citable($1, 'driving test failed', 20)", [f.legacyId])).toHaveLength(0);
    // Writes to the author's content are impossible for recipients.
    const upd = await rawAs(pool(), f.son.person.accountId, "update memory_item set sensitivity = 'sensitive' where id = $1 returning id", [f.m.money]);
    expect(upd).toHaveLength(0);
    await expect(rawAs(pool(), f.son.person.accountId, "insert into memory_version (memory_id, legacy_id, version_no, title, body, created_by) values ($1, $2, 9, 'x', 'y', $3)", [f.m.money, f.legacyId, f.son.person.accountId])).rejects.toThrow(/row-level security/);
    // The other legacy's recipients see nothing of this one.
    for (const t of ["memory_item", "memory_version", "media_asset", "citable_source"]) {
      expect(await rawAs(pool(), g.son.person.accountId, `select * from ${t} where legacy_id = $1`, [f.legacyId])).toHaveLength(0);
    }
  });
});

describe("Reports (recipient → author)", () => {
  it("a recipient can report an answer; the author sees the reason, sources and (only if included) the question", async () => {
    const f = await family();
    await setItemShares(f.a, f.legacyId, f.m.driving, [f.son.recipientId, f.daughter.recipientId]);
    const ans = await recipientAsk(f.son.person, f.legacyId, "What happened with your driving test?");
    const other = await recipientAsk(f.son.person, f.legacyId, "Tell me about your driving test");
    await reportAnswer(f.son.person, f.legacyId, ans.turnId, { reason: "not_what_they_meant", note: "He passed on the second try, I think.", includeQuestion: true });
    await reportAnswer(f.son.person, f.legacyId, other.turnId, { reason: "upsetting" });
    await expect(reportAnswer(f.daughter.person, f.legacyId, ans.turnId, { reason: "other" })).rejects.toBeInstanceOf(NotFoundError);
    const reports = await listReports(f.a, f.legacyId);
    expect(reports).toHaveLength(2);
    const withQ = reports.find((r) => r.reason === "not_what_they_meant")!;
    expect(withQ).toMatchObject({ question: "What happened with your driving test?", note: "He passed on the second try, I think.", evidence: "E1" });
    expect(withQ.sources.map((s) => s.title)).toEqual(["My driving test"]);
    expect(reports.find((r) => r.reason === "upsetting")!.question).toBeNull();
    await resolveReport(f.a, f.legacyId, withQ.id);
    expect((await listReports(f.a, f.legacyId)).find((r) => r.id === withQ.id)!.resolvedAt).not.toBeNull();
    await expect(rawAs(pool(), f.a.accountId, "update answer_report set note = 'edited' where id = $1", [withQ.id])).rejects.toThrow(/permission denied/);
    await expect(resolveReport(f.daughter.person, f.legacyId, withQ.id)).rejects.toBeInstanceOf(NotFoundError);
    const safety = await recipientAsk(f.son.person, f.legacyId, "I want to die");
    await expect(reportAnswer(f.son.person, f.legacyId, safety.turnId, { reason: "other" })).rejects.toBeInstanceOf(ValidationError);
  });
});
