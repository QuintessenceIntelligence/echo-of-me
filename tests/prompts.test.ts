/**
 * Module 05, guided prompt library (ADR-010): editorial prompts, answered/hidden state, follow-ups and gaps.
 */
import { describe, expect, it } from "vitest";
import { NotFoundError, ValidationError } from "../src/domain/errors";
import { exportLegacy } from "../src/domain/export";
import { createLegacy } from "../src/domain/onboarding";
import { gapQuestions, getPrompt, listPrompts, nextPrompts, setPromptDismissed, THEMES } from "../src/domain/prompts";
import { answerYourself, rehearse } from "../src/domain/rehearsal";
import { createMemory, getMemory } from "../src/domain/vault";
import { useTempBlobStore } from "./fixtures";
import { makePerson, rawAs, rawSystem, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();
useTempBlobStore();
const C = ["terms_of_service", "privacy_notice", "ai_processing"] as const;

async function author(label = "prompts") {
  const a = await makePerson(label, [...C]);
  const { legacyId } = await createLegacy(a, { title: "For you", authorDisplayName: "Mum" });
  return { a, legacyId };
}

describe("Editorial prompt set", () => {
  it("offers 35 active prompts across the seven themes, with heavy ones marked gentle", async () => {
    const { a, legacyId } = await author();
    const prompts = await listPrompts(a, legacyId);
    expect(prompts).toHaveLength(35);
    expect([...new Set(prompts.map((p) => p.theme))]).toEqual([...THEMES]);
    expect(prompts.filter((p) => p.theme === "adversity" && p.gentle).length).toBeGreaterThanOrEqual(3);
    expect(prompts.every((p) => p.answeredBy.length === 0 && !p.dismissed)).toBe(true);
    expect(await getPrompt(a, "values-01")).toMatchObject({ theme: "values" });
    expect(await getPrompt(a, "'; drop table prompt; --")).toBeNull();
  });

  it("is read-only for the application and cannot be rewritten even by the database owner", async () => {
    const { a } = await author("promptsRO");
    await expect(rawAs(pool(), a.accountId, "insert into prompt (id, set_version, theme, position, text) values ('values-99', 'x', 'values', 99, 'Injected prompt text')")).rejects.toThrow(/permission denied|row-level security/);
    await expect(rawAs(pool(), a.accountId, "update prompt set hint = 'x' where id = 'values-01'")).rejects.toThrow(/permission denied/);
    await expect(rawSystem(pool(), "update prompt set text = 'Rewritten' where id = 'values-01'")).rejects.toThrow(/immutable/);
  });
});

describe("Answering prompts", () => {
  it("links the new item to its prompt, shows it as answered, suggests the next ones in the theme and exports the link", async () => {
    const { a, legacyId } = await author();
    const { memoryId } = await createMemory(a, legacyId, { kind: "value_statement", title: "Honesty", body: "Tell the truth.", promptId: "values-01", approve: true });
    expect((await getMemory(a, legacyId, memoryId)).prompt).toMatchObject({ id: "values-01", theme: "values" });
    const p = (await listPrompts(a, legacyId)).find((x) => x.id === "values-01")!;
    expect(p.answeredBy).toEqual([{ memoryId, title: "Honesty" }]);
    const next = await nextPrompts(a, legacyId, "values-01");
    expect(next.map((n) => n.id)).toEqual(["values-02", "values-03", "values-04"]);
    await setPromptDismissed(a, legacyId, "values-02", true);
    expect((await nextPrompts(a, legacyId, "values-01")).map((n) => n.id)).toEqual(["values-03", "values-04", "values-05"]);
    expect((await nextPrompts(a, legacyId, "values-05", 2)).map((n) => n.id)).toEqual(["values-03", "values-04"]);
    const { manifest } = await exportLegacy(a, legacyId);
    expect((manifest.memories[0] as Record<string, unknown>).answered_prompt).toMatchObject({ id: "values-01" });
  });

  it("refuses unknown or retired prompts", async () => {
    const { a, legacyId } = await author();
    await expect(createMemory(a, legacyId, { kind: "memory", title: "x", body: "y", promptId: "values-77" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createMemory(a, legacyId, { kind: "memory", title: "x", body: "y", promptId: "not a prompt" as never })).rejects.toBeInstanceOf(ValidationError);
    await rawSystem(pool(), "update prompt set retired_in = '0.2' where id = 'mistakes-05'");
    await expect(createMemory(a, legacyId, { kind: "memory", title: "x", body: "y", promptId: "mistakes-05" })).rejects.toBeInstanceOf(ValidationError);
    expect((await listPrompts(a, legacyId)).some((p) => p.id === "mistakes-05")).toBe(false);
    await rawSystem(pool(), "update prompt set retired_in = null where id = 'mistakes-05'");
  });

  it("hidden prompts are per legacy, can be restored, and other families cannot change them", async () => {
    const { a, legacyId } = await author("hideA");
    const { a: b, legacyId: lb } = await author("hideB");
    await setPromptDismissed(a, legacyId, "adversity-05", true);
    expect((await listPrompts(a, legacyId)).find((p) => p.id === "adversity-05")!.dismissed).toBe(true);
    expect((await listPrompts(b, lb)).find((p) => p.id === "adversity-05")!.dismissed).toBe(false);
    await expect(setPromptDismissed(b, legacyId, "adversity-04", true)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listPrompts(b, legacyId)).rejects.toBeInstanceOf(NotFoundError);
    expect(await rawAs(pool(), b.accountId, "select * from prompt_dismissal where legacy_id = $1", [legacyId])).toHaveLength(0);
    await setPromptDismissed(a, legacyId, "adversity-05", false);
    expect((await listPrompts(a, legacyId)).find((p) => p.id === "adversity-05")!.dismissed).toBe(false);
  });
});

describe("Gaps from practice questions", () => {
  it("lists unanswered practice questions once per topic, and drops them once answered or pinned", async () => {
    const { a, legacyId } = await author();
    await createMemory(a, legacyId, { kind: "memory", title: "Saving money", body: "Save a tenth first.", approve: true });
    await rehearse(a, legacyId, "Should I study medicine or law?");
    await rehearse(a, legacyId, "law or medicine, which should I study?");
    await rehearse(a, legacyId, "Which football team do you support?");
    await rehearse(a, legacyId, "How should I save money?"); // answered: not a gap
    await rehearse(a, legacyId, "I want to die"); // safety: never a gap, never stored
    let gaps = await gapQuestions(a, legacyId);
    expect(gaps.map((g) => g.question)).toEqual(["Which football team do you support?", "law or medicine, which should I study?"]);
    expect(gaps.find((g) => g.question.startsWith("law"))!.times).toBe(2);

    const q = await rehearse(a, legacyId, "Should I study medicine or law?");
    await answerYourself(a, legacyId, q.turnId, { body: "Choose the one that lets you help people." });
    gaps = await gapQuestions(a, legacyId);
    expect(gaps.map((g) => g.question)).toEqual(["Which football team do you support?"]);

    await createMemory(a, legacyId, { kind: "memory", title: "Our football team", body: "We support the local football team, always.", approve: true });
    await rehearse(a, legacyId, "Which football team do you support?");
    expect(await gapQuestions(a, legacyId)).toEqual([]);

    const { a: b } = await author("gapOther");
    await expect(gapQuestions(b, legacyId)).rejects.toBeInstanceOf(NotFoundError);
  });
});
