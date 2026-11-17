import { z } from "zod";
import { withActor, type Queryable } from "../server/db";
import { audit, guarded } from "./audit";
import type { AuthContext } from "./auth";
import { assertConsents } from "./consent";
import { ValidationError } from "./errors";
import { ownedLegacy } from "./onboarding";
import { HELP_RESOURCES, isCrisis, isIdentityQuestion } from "./safety";
import type { Provenance } from "./vault";

/**
 * Module 03/04 foundation: grounded answers WITHOUT a language model (slice 3a, ADR-007a).
 *
 * Pipeline (01B §4.6): safety screen → identity screen → search ONLY approved material
 * (app.search_citable over the citable_source view) → evidence class E1/E2/E3 → extractive answer that
 * quotes the author's approved words verbatim with citations, or says plainly that nothing was recorded.
 * Nothing is generated, paraphrased or attributed beyond the quoted text. A language model can later
 * replace the composer step (ADR-007) behind the same evidence rules and tests.
 *
 * Classification is lexical (shared topic words), so it can miss paraphrases. That fails safe: a missed
 * match becomes "not recorded", never an invented answer.
 */

export type EvidenceClass = "E1" | "E2" | "E3";

export interface Passage {
  sourceType: "memory_version" | "media_asset" | "transcript_version";
  sourceId: string;
  memoryId: string;
  kind: "memory" | "value_statement";
  title: string;
  /** Verbatim text from the approved source (null for a recording, which is played instead). */
  quote: string | null;
  truncated: boolean;
  provenance: Provenance;
  mediaAssetId: string | null;
  sensitive: boolean;
  approvedAt: string;
  versionNo: number | null;
}

export interface Answer {
  kind: "grounded" | "not_recorded" | "identity" | "safety" | "empty_question";
  evidence: EvidenceClass | null;
  /** Always shown: what this interface is (AC-09). */
  disclosure: string;
  lead: string;
  passages: Passage[];
  adjacent: { memoryId: string; title: string; kind: string }[];
  resources: { name: string; contact: string; note: string }[];
  turnId: string;
}

export const THRESHOLDS = {
  /** E1: share of the question's topic words found in one text source, and the minimum count. */
  directCoverage: 0.6,
  directMinTerms: 2,
  /** E2: weaker overlap with at least one source. */
  relatedCoverage: 0.34,
  maxPassages: 3,
} as const;

const Question = z.string().trim().min(1, "Please type a question.").max(500, "Please keep questions under 500 characters.");

export function disclosureFor(authorName: string): string {
  return `This is Echo of Me, an AI interface to what ${authorName} recorded and approved. It is not ${authorName}, and it only shows their own words.`;
}

interface Row {
  source_type: Passage["sourceType"];
  source_id: string;
  memory_id: string;
  kind: Passage["kind"];
  provenance: Provenance;
  title: string;
  quote: string | null;
  full_length: number;
  media_asset_id: string | null;
  sensitivity: "standard" | "sensitive";
  approved_at: Date;
  version_no: number | null;
  matched: number;
  query_terms: number;
}

export function classify(rows: Pick<Row, "source_type" | "matched" | "query_terms">[]): EvidenceClass {
  const textual = rows.filter((r) => r.source_type !== "media_asset");
  const direct = textual.find((r) => {
    const need = Math.min(THRESHOLDS.directMinTerms, r.query_terms);
    return r.matched >= need && r.matched / r.query_terms >= THRESHOLDS.directCoverage;
  });
  if (direct) return "E1";
  if (rows.some((r) => r.matched >= 2 || r.matched / r.query_terms >= THRESHOLDS.relatedCoverage)) return "E2";
  return "E3";
}

function toPassage(r: Row): Passage {
  return {
    sourceType: r.source_type,
    sourceId: r.source_id,
    memoryId: r.memory_id,
    kind: r.kind,
    title: r.title,
    quote: r.quote,
    truncated: r.quote !== null && r.quote.length < r.full_length,
    provenance: r.provenance,
    mediaAssetId: r.media_asset_id,
    sensitive: r.sensitivity === "sensitive",
    approvedAt: new Date(r.approved_at).toISOString(),
    versionNo: r.version_no,
  };
}

/** One passage per item: prefer the author's text, then an approved transcript, then the recording. */
function pickPassages(rows: Row[], max: number): Passage[] {
  const order = { memory_version: 0, transcript_version: 1, media_asset: 2 } as const;
  const byItem = new Map<string, Row[]>();
  for (const r of rows) byItem.set(r.memory_id, [...(byItem.get(r.memory_id) ?? []), r]);
  const out: Passage[] = [];
  for (const group of byItem.values()) {
    const best = [...group].sort((a, b) => b.matched - a.matched || order[a.source_type] - order[b.source_type])[0];
    out.push(toPassage(best));
    // Offer the original recording next to the words when the item has one.
    const rec = group.find((g) => g.source_type === "media_asset" && g.source_id !== best.source_id);
    if (rec && out.length < max * 2) out.push(toPassage(rec));
    if (out.filter((p) => p.sourceType !== "media_asset").length >= max) break;
  }
  return out;
}

async function recordTurn(
  db: Queryable,
  ctx: AuthContext,
  legacyId: string,
  question: string | null,
  kind: Answer["kind"],
  evidence: EvidenceClass | null,
  sourceIds: string[],
): Promise<string> {
  const { rows } = await db.query(
    `insert into rehearsal_turn (legacy_id, asked_by, question, kind, evidence, source_ids)
     values ($1, $2, $3, $4, $5, $6::uuid[]) returning id`,
    [legacyId, ctx.accountId, question, kind, evidence, sourceIds],
  );
  await audit(db, ctx, {
    action: "answer.rehearse",
    legacyId,
    targetType: "rehearsal_turn",
    targetId: rows[0].id,
    detail: { kind, evidence, sources: sourceIds.length, source_ids: sourceIds.join(",") || null },
  });
  return rows[0].id as string;
}

/**
 * The author asks a question as a future recipient might (rehearsal, module 04). Needs the
 * AI-processing consent, whose text covers answering questions from approved material.
 */
export async function rehearse(ctx: AuthContext, legacyId: string, rawQuestion: string): Promise<Answer> {
  const parsed = Question.safeParse(rawQuestion);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  const question = parsed.data;
  return guarded(ctx, "answer.rehearse", { legacyId, targetType: "legacy", targetId: legacyId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    await assertConsents(db, ctx, ["ai_processing"]);
    const author = (await db.query("select author_display_name from legacy where id = $1", [legacyId])).rows[0].author_display_name as string;
    const disclosure = disclosureFor(author);
    const base = { disclosure, passages: [] as Passage[], adjacent: [] as Answer["adjacent"], resources: [] as Answer["resources"] };

    if (isCrisis(question)) {
      const turnId = await recordTurn(db, ctx, legacyId, null, "safety", null, []);
      return {
        ...base,
        kind: "safety",
        evidence: null,
        lead:
          "It sounds like you might be going through something very hard. This is not something Echo of Me can help with, " +
          "and it will not answer in anyone's voice. Please reach out to a person now: someone you trust, or one of these free services.",
        resources: [...HELP_RESOURCES],
        turnId,
      };
    }
    if (isIdentityQuestion(question)) {
      const turnId = await recordTurn(db, ctx, legacyId, question, "identity", null, []);
      return {
        ...base,
        kind: "identity",
        evidence: null,
        lead: `No. I am Echo of Me, an AI interface. I am not ${author}, I cannot think or feel as them, and I never speak for them. I can only show you what ${author} chose to record and approve, and tell you when they did not record something.`,
        turnId,
      };
    }

    const terms = (await db.query("select app.question_terms($1) as t", [question])).rows[0].t as string[];
    if (terms.length === 0) {
      const turnId = await recordTurn(db, ctx, legacyId, question, "empty_question", null, []);
      return { ...base, kind: "empty_question", evidence: null, lead: "Please ask about a topic, a person or a time, for example “What did you learn from failing?”.", turnId };
    }

    const rows = (await db.query("select * from app.search_citable($1, $2, 12)", [legacyId, question])).rows as Row[];
    const evidence = classify(rows);
    if (evidence === "E3") {
      const adjacent = (await db.query("select memory_id, title, kind from app.adjacent_memories($1, 3)", [legacyId])).rows.map((r) => ({
        memoryId: r.memory_id as string,
        title: r.title as string,
        kind: r.kind as string,
      }));
      const turnId = await recordTurn(db, ctx, legacyId, question, "not_recorded", "E3", []);
      return {
        ...base,
        kind: "not_recorded",
        evidence,
        lead: `I don't have anything ${author} recorded about that.` + (adjacent.length ? ` Here are some things ${author} did record.` : ""),
        adjacent,
        turnId,
      };
    }
    const relevant = evidence === "E1" ? rows.filter((r) => r.matched / r.query_terms >= THRESHOLDS.relatedCoverage || r.matched >= 2) : rows;
    const passages = pickPassages(relevant, THRESHOLDS.maxPassages);
    const turnId = await recordTurn(db, ctx, legacyId, question, "grounded", evidence, passages.map((p) => p.sourceId));
    return {
      ...base,
      kind: "grounded",
      evidence,
      lead:
        evidence === "E1"
          ? `In ${author}'s own words:`
          : `${author} did not record anything that answers this directly. Based on what they recorded, these may be related:`,
      passages,
      turnId,
    };
  });
}

export interface TurnView {
  id: string;
  question: string | null;
  kind: Answer["kind"];
  evidence: EvidenceClass | null;
  sources: number;
  createdAt: string;
}

export async function rehearsalHistory(ctx: AuthContext, legacyId: string, limit = 20): Promise<TurnView[]> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const { rows } = await db.query(
      "select id, question, kind, evidence, cardinality(source_ids) as n, created_at from rehearsal_turn where legacy_id = $1 order by created_at desc limit $2",
      [legacyId, Math.min(Math.max(limit, 1), 100)],
    );
    return rows.map((r) => ({ id: r.id, question: r.question, kind: r.kind, evidence: r.evidence, sources: r.n, createdAt: new Date(r.created_at).toISOString() }));
  });
}

export async function clearRehearsalHistory(ctx: AuthContext, legacyId: string): Promise<{ removed: number }> {
  return guarded(ctx, "rehearsal.clear", { legacyId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const res = await db.query("delete from rehearsal_turn where legacy_id = $1", [legacyId]);
    await audit(db, ctx, { action: "rehearsal.clear", legacyId, detail: { removed: res.rowCount ?? 0 } });
    return { removed: res.rowCount ?? 0 };
  });
}

