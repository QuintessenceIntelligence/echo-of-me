/**
 * Slice 4: author rehearsal controls (AC-11, ADR-008). Pin, suppress and "answer it yourself".
 */
import { describe, expect, it } from "vitest";
import { MfaRequiredError, NotFoundError, ValidationError } from "../src/domain/errors";
import { createLegacy } from "../src/domain/onboarding";
import {
  answerYourself,
  listAnswerRules,
  pinAnswer,
  rehearse,
  removeAnswerRule,
  suppressForQuestion,
} from "../src/domain/rehearsal";
import { citableSources, createMemory, deleteMemory, editMemory, getMemory } from "../src/domain/vault";
import { useTempBlobStore } from "./fixtures";
import { makePerson, rawAs, rawSystem, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();
useTempBlobStore();
const FULL = ["terms_of_service", "privacy_notice", "ai_processing"] as const;

async function setup(prefix = "rules") {
  const a = await makePerson(prefix, [...FULL]);
  const { legacyId } = await createLegacy(a, { title: "For you", authorDisplayName: "Mum" });
  const add = async (title: string, body: string, approve = true) => (await createMemory(a, legacyId, { kind: "memory", title, body, approve })).memoryId;
  const ids = {
    exam: await add("My matric exams", "I studied every night with a candle. Exams are about patience."),
    failing: await add("Failing at work", "When I failed at work I asked for help. Failing is how you learn."),
    holiday: await add("Our holiday in Durban", "We swam every morning and ate bunny chow."),
    draft: await add("Unfinished thoughts on exams", "Exams scare me. Draft words.", false),
  };
  return { a, legacyId, ids };
}

const ids = (ans: Awaited<ReturnType<typeof rehearse>>) => ans.passages.filter((p) => p.sourceType === "memory_version").map((p) => p.memoryId);

describe("Pin (served as E1 with the author's pin date)", () => {
  it("a pinned item becomes the direct answer, also for the same topic words phrased differently", async () => {
    const { a, legacyId, ids: m } = await setup();
    const first = await rehearse(a, legacyId, "How should I handle failing an exam?");
    expect(first.evidence).not.toBe("E1"); // one of three topic words in common: not a direct answer
    expect(first.teachable).toBe(true);
    await pinAnswer(a, legacyId, first.turnId, m.exam);

    const again = await rehearse(a, legacyId, "failing an exam, how should I handle it?");
    expect(again).toMatchObject({ kind: "grounded", evidence: "E1", lead: "In Mum's own words:" });
    expect(ids(again)).toEqual([m.exam]);
    expect(again.passages[0].quote).toBe("I studied every night with a candle. Exams are about patience.");
    expect(again.rules.pinnedAt).not.toBeNull();
    // Different topic words are not affected.
    expect(ids(await rehearse(a, legacyId, "What did you learn from failing at work?"))).toContain(m.failing);
  });

  it("a pin can answer a question that had no answer (E3 → E1), and a new pin replaces the old one", async () => {
    const { a, legacyId, ids: m } = await setup();
    const q = await rehearse(a, legacyId, "Where should we go on holiday together?");
    await pinAnswer(a, legacyId, q.turnId, m.exam);
    await pinAnswer(a, legacyId, q.turnId, m.holiday);
    const ans = await rehearse(a, legacyId, "Where should we go on holiday together?");
    expect(ids(ans)).toEqual([m.holiday]);
    expect((await listAnswerRules(a, legacyId)).filter((r) => r.action === "pin")).toHaveLength(1);
  });

  it("only approved items can be pinned, and a pin on an item that returns to draft is inactive (never serves unapproved words)", async () => {
    const { a, legacyId, ids: m } = await setup();
    const q = await rehearse(a, legacyId, "Tell me about exams");
    await expect(pinAnswer(a, legacyId, q.turnId, m.draft)).rejects.toBeInstanceOf(ValidationError);
    await pinAnswer(a, legacyId, q.turnId, m.exam);
    await editMemory(a, legacyId, m.exam, { expectedVersion: 1, title: "My matric exams", body: "NEW DRAFT WORDING about exams" });
    const ans = await rehearse(a, legacyId, "Tell me about exams");
    expect(JSON.stringify(ans)).not.toContain("NEW DRAFT WORDING");
    expect(ans.rules.pinnedAt).toBeNull();
    expect((await listAnswerRules(a, legacyId))[0]).toMatchObject({ action: "pin", active: false });
  });

  it("deleting the pinned item removes its rules", async () => {
    const { a, legacyId, ids: m } = await setup();
    const q = await rehearse(a, legacyId, "Tell me about the beach");
    await pinAnswer(a, legacyId, q.turnId, m.holiday);
    await deleteMemory(a, legacyId, m.holiday);
    expect(await listAnswerRules(a, legacyId)).toEqual([]);
  });
});

describe("Suppress (never use this item for this question)", () => {
  it("hides the item for this question only; if nothing else matches the answer becomes 'not recorded'", async () => {
    const { a, legacyId, ids: m } = await setup();
    const q = await rehearse(a, legacyId, "What did you learn from failing at work?");
    expect(ids(q)).toContain(m.failing);
    await suppressForQuestion(a, legacyId, q.turnId, m.failing);
    const after = await rehearse(a, legacyId, "What did you learn from failing at work?");
    expect(ids(after)).not.toContain(m.failing);
    expect(after.rules.suppressed).toBe(1);
    expect(after.adjacent.map((x) => x.memoryId)).not.toContain(m.failing);
    // Still used for other questions.
    expect(ids(await rehearse(a, legacyId, "Is failing how you learn?"))).toContain(m.failing);
  });

  it("pinning a suppressed item un-suppresses it, and removing a rule restores normal behaviour", async () => {
    const { a, legacyId, ids: m } = await setup();
    const q = await rehearse(a, legacyId, "What did you learn from failing at work?");
    const { ruleId } = await suppressForQuestion(a, legacyId, q.turnId, m.failing);
    await removeAnswerRule(a, legacyId, ruleId);
    expect(ids(await rehearse(a, legacyId, "What did you learn from failing at work?"))).toContain(m.failing);
    await suppressForQuestion(a, legacyId, q.turnId, m.failing);
    await pinAnswer(a, legacyId, q.turnId, m.failing);
    const rules = await listAnswerRules(a, legacyId);
    expect(rules.map((r) => r.action)).toEqual(["pin"]);
  });
});

describe("Answer it yourself (correction)", () => {
  it("creates an approved item in the author's own words (P2), pins it, and quotes it verbatim", async () => {
    const { a, legacyId } = await setup();
    const q = await rehearse(a, legacyId, "Should I study medicine or law?");
    expect(q.evidence).toBe("E3");
    const { memoryId } = await answerYourself(a, legacyId, q.turnId, { body: "Choose the one that lets you help people every day. I would be proud either way." });
    const item = await getMemory(a, legacyId, memoryId);
    expect(item).toMatchObject({ kind: "value_statement", approval: "approved", textProvenance: "P2_author_written" });
    expect(item.current.title).toBe("Should I study medicine or law?");
    const ans = await rehearse(a, legacyId, "Should I study medicine or law?");
    expect(ans).toMatchObject({ evidence: "E1" });
    expect(ans.passages[0]).toMatchObject({ memoryId, quote: "Choose the one that lets you help people every day. I would be proud either way.", provenance: "P2_author_written" });
    expect((await citableSources(a, legacyId)).some((c) => c.memoryId === memoryId)).toBe(true);
  });

  it("is refused for safety and identity questions, empty answers, and unknown questions", async () => {
    const { a, legacyId, ids: m } = await setup();
    const safety = await rehearse(a, legacyId, "I want to die");
    const identity = await rehearse(a, legacyId, "Are you really my mum?");
    expect(safety.teachable).toBe(false);
    expect(identity.teachable).toBe(false);
    await expect(answerYourself(a, legacyId, safety.turnId, { body: "x" })).rejects.toBeInstanceOf(ValidationError);
    await expect(pinAnswer(a, legacyId, identity.turnId, m.exam)).rejects.toBeInstanceOf(ValidationError);
    const ok = await rehearse(a, legacyId, "Tell me about exams");
    await expect(answerYourself(a, legacyId, ok.turnId, { body: "   " })).rejects.toBeInstanceOf(ValidationError);
    await expect(pinAnswer(a, legacyId, "00000000-0000-0000-0000-000000000000", m.exam)).rejects.toBeInstanceOf(NotFoundError);
    await expect(pinAnswer(a, legacyId, ok.turnId, "not-a-uuid")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("Audit, immutability and isolation", () => {
  it("rules belong to one legacy: an author with two legacies keeps them separate", async () => {
    const { a, legacyId, ids: m } = await setup("twoLegacies");
    const { legacyId: second } = await createLegacy(a, { title: "Second", authorDisplayName: "Mum" });
    const { memoryId: other } = await createMemory(a, second, { kind: "memory", title: "Exams in the second legacy", body: "Different words about exams.", approve: true });
    const q = await rehearse(a, legacyId, "Tell me about exams");
    await pinAnswer(a, legacyId, q.turnId, m.exam);
    await expect(pinAnswer(a, second, q.turnId, other)).rejects.toBeInstanceOf(NotFoundError); // question belongs to the first legacy
    const inSecond = await rehearse(a, second, "Tell me about exams");
    expect(inSecond.rules.pinnedAt).toBeNull();
    expect(ids(inSecond)).toEqual([other]);
    expect(await listAnswerRules(a, second)).toEqual([]);
  });

  it("rule changes are audited without question text and cannot be edited in place", async () => {
    const { a, legacyId, ids: m } = await setup();
    const q = await rehearse(a, legacyId, "Tell me about exams");
    const { ruleId } = await pinAnswer(a, legacyId, q.turnId, m.exam);
    const ev = await rawSystem<{ action: string; detail: Record<string, unknown> }>(pool(), "select action, detail from audit_event where target_id = $1", [ruleId]);
    expect(ev[0].action).toBe("answer.pin");
    expect(JSON.stringify(ev[0].detail)).not.toContain("exams");
    await expect(rawAs(pool(), a.accountId, "update answer_rule set memory_id = memory_id where id = $1", [ruleId])).rejects.toThrow(/permission denied|immutable/);
  });

  it("another family cannot use, see or create rules on this legacy, even with a valid question id", async () => {
    const { a, legacyId, ids: m } = await setup("rulesA");
    const q = await rehearse(a, legacyId, "Tell me about exams");
    const { ruleId } = await pinAnswer(a, legacyId, q.turnId, m.exam);
    const b = await makePerson("rulesB", [...FULL]);
    const { legacyId: legacyB } = await createLegacy(b, { title: "B", authorDisplayName: "B" });
    const { memoryId: memB } = await createMemory(b, legacyB, { kind: "memory", title: "B exams", body: "B words about exams", approve: true });

    await expect(pinAnswer(b, legacyId, q.turnId, m.exam)).rejects.toBeInstanceOf(NotFoundError);
    await expect(pinAnswer(b, legacyB, q.turnId, memB)).rejects.toBeInstanceOf(NotFoundError); // A's question id in B's legacy
    await expect(suppressForQuestion(b, legacyId, q.turnId, m.exam)).rejects.toBeInstanceOf(NotFoundError);
    await expect(answerYourself(b, legacyId, q.turnId, { body: "hijack" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeAnswerRule(b, legacyId, ruleId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(removeAnswerRule(b, legacyB, ruleId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listAnswerRules(b, legacyId)).rejects.toBeInstanceOf(NotFoundError);
    // A's own pin cannot point at B's item: composite key.
    const qa = await rehearse(a, legacyId, "B exams words");
    await expect(pinAnswer(a, legacyId, qa.turnId, memB)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      rawAs(pool(), a.accountId, "insert into answer_rule (legacy_id, memory_id, question, terms, action, created_by) values ($1, $2, 'q', '{unrelated}', 'pin', $3)", [legacyId, memB, a.accountId]),
    ).rejects.toThrow(/foreign key/);
    expect(await rawAs(pool(), b.accountId, "select * from answer_rule where legacy_id = $1", [legacyId])).toHaveLength(0);
    await expect(
      rawAs(pool(), b.accountId, "insert into answer_rule (legacy_id, memory_id, question, terms, action, created_by) values ($1, $2, 'q', '{unrelated}', 'pin', $3)", [legacyId, m.exam, b.accountId]),
    ).rejects.toThrow(/row-level security/);
    expect(ids(await rehearse(a, legacyId, "Tell me about exams"))).toEqual([m.exam]);
    expect(MfaRequiredError).toBeDefined();
  });
});
