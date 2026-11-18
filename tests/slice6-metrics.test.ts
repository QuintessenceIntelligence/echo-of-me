/**
 * Slice 6: pilot measures (ADR-011). Aggregates only, from existing data; operator-only function.
 */
import { describe, expect, it } from "vitest";
import { createLegacy } from "../src/domain/onboarding";
import { getProgress } from "../src/domain/progress";
import { rehearse } from "../src/domain/rehearsal";
import { addMedia, createMemory } from "../src/domain/vault";
import { useTempBlobStore, wav } from "./fixtures";
import { makePerson, rawAs, useFreshDatabase } from "./helpers";

const pool = useFreshDatabase();
useTempBlobStore();
const C = ["terms_of_service", "privacy_notice", "audio_recording", "ai_processing"] as const;

async function asMetricsRole<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = await pool().connect();
  try {
    await client.query("set role echo_metrics");
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.query("reset role");
    client.release();
  }
}

describe("Author progress", () => {
  it("counts the author's own items, recordings, capture days and practice outcomes", async () => {
    const a = await makePerson("progress", [...C]);
    const { legacyId } = await createLegacy(a, { title: "P", authorDisplayName: "P" });
    const { memoryId } = await createMemory(a, legacyId, { kind: "memory", title: "Saving money", body: "Save a tenth.", approve: true });
    await createMemory(a, legacyId, { kind: "memory", title: "Draft", body: "draft" });
    await addMedia(a, legacyId, memoryId, { bytes: wav(), capture: "upload" });
    await rehearse(a, legacyId, "Which football team do you support?");
    const p = await getProgress(a, legacyId);
    expect(p).toMatchObject({ approvedItems: 0, draftItems: 2, recordings: 1, captureDays: 1, daysSinceLastCapture: 0, practiceAnswered: 0, practiceNotRecorded: 1, sharedItems: 0, openReports: 0 });
  });
});

describe("Operator pilot metrics", () => {
  it("returns aggregates only (no ids or content) for H1, H2 and abstention", async () => {
    const a = await makePerson("metricsA", [...C]);
    const { legacyId } = await createLegacy(a, { title: "A", authorDisplayName: "A" });
    for (let i = 0; i < 5; i++) await createMemory(a, legacyId, { kind: "memory", title: `Memory ${i}`, body: `Secret content ${i}`, approve: true });
    const b = await makePerson("metricsB", [...C]);
    const { legacyId: lb } = await createLegacy(b, { title: "B", authorDisplayName: "B" });
    await createMemory(b, lb, { kind: "memory", title: "Only one", body: "Private words", approve: true });
    await rehearse(a, legacyId, "Tell me about Memory");
    await rehearse(a, legacyId, "Which football team do you support?");
    await rehearse(b, lb, "I want to die");

    const rows = await asMetricsRole<{ metric: string; value: string | null; denominator: number | null }>("select * from app.pilot_metrics()");
    const m = Object.fromEntries(rows.map((r) => [r.metric, r.value === null ? null : Number(r.value)]));
    expect(m.legacies).toBeGreaterThanOrEqual(2);
    expect(m.h1_five_approved_within_21_days_pct).toBeGreaterThan(0);
    expect(m.h1_five_approved_within_21_days_pct).toBeLessThan(100);
    expect(m.h2_second_capture_day_within_14_days_pct).toBe(0); // everything happened on one day
    expect(m.practice_answers_not_recorded_pct).toBeGreaterThan(0);
    expect(m.safety_routings).toBeGreaterThanOrEqual(1);
    const text = JSON.stringify(rows);
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    expect(text).not.toMatch(/Secret content|Private words|football|Memory 0/);
  });

  it("the application role (and the least-privilege login) cannot run it, and the metrics role cannot read tables", async () => {
    const a = await makePerson("metricsC", [...C]);
    await expect(rawAs(pool(), a.accountId, "select * from app.pilot_metrics()")).rejects.toThrow(/permission denied/);
    await expect(asMetricsRole("select * from memory_item")).rejects.toThrow(/permission denied/);
    await expect(asMetricsRole("select * from audit_event")).rejects.toThrow(/permission denied/);
  });
});
