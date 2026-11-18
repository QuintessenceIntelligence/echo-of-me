import { z } from "zod";
import { withActor, type Queryable } from "../server/db";
import { audit, guarded } from "./audit";
import type { AuthContext } from "./auth";
import { assertConsents } from "./consent";
import { NotFoundError, PolicyError, ValidationError } from "./errors";
import { ownedLegacy } from "./onboarding";
import { HELP_RESOURCES, isCrisis, isIdentityQuestion } from "./safety";
import { insertMemoryTx, parseMemoryInput, type Provenance } from "./vault";
import { enforceLimit } from "./limits";

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
  /** Author rules that shaped this answer (slice 4). */
  rules: { pinnedAt: string | null; pinRuleId: string | null; suppressed: number };
  /** True when the author can pin, suppress or answer this question themselves. */
  teachable: boolean;
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

const UUID = z.uuid();
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
  title_matched: number;
  query_terms: number;
}

/**
 * Evidence for one source. One shared topic word is weak evidence unless it is in the item's title:
 * everyday words ("move", "choose") in the body of an unrelated memory must not count as related
 * (evaluation finding E-01).
 */
export function isRelated(r: Pick<Row, "matched" | "query_terms"> & { title_matched?: number }): boolean {
  return (
    r.matched >= 2 ||
    ((r.title_matched ?? 0) >= 1 && r.matched / r.query_terms >= THRESHOLDS.relatedCoverage) ||
    // A one-topic question ("tell me about tomatoes") mentioned in the body is related, never direct.
    (r.query_terms === 1 && r.matched === 1)
  );
}

/** Direct (E1) needs most of the question's topic words, and more than one shared word unless it is in the title. */
export function isDirect(r: Pick<Row, "source_type" | "matched" | "query_terms"> & { title_matched?: number }): boolean {
  if (r.source_type === "media_asset") return false;
  const need = Math.min(THRESHOLDS.directMinTerms, r.query_terms);
  return r.matched >= need && r.matched / r.query_terms >= THRESHOLDS.directCoverage && (r.matched >= 2 || (r.title_matched ?? 0) >= 1);
}

export function classify(rows: (Pick<Row, "source_type" | "matched" | "query_terms"> & { title_matched?: number })[]): EvidenceClass {
  if (rows.some(isDirect)) return "E1";
  if (rows.some(isRelated)) return "E2";
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

interface Composed {
  answer: Omit<Answer, "turnId">;
  record: { question: string | null; kind: Answer["kind"]; evidence: EvidenceClass | null; sourceIds: string[] };
}

/**
 * The shared answer pipeline (author rehearsal and recipient questions). Runs inside the caller's
 * RLS-scoped transaction, so the material it can see is exactly what the caller may see:
 * the author sees all approved items, a recipient only approved items shared with them.
 */
async function composeAnswer(db: Queryable, legacyId: string, question: string, author: string): Promise<Composed> {
  const disclosure = disclosureFor(author);
  const base = {
    disclosure,
    passages: [] as Passage[],
    adjacent: [] as Answer["adjacent"],
    resources: [] as Answer["resources"],
    rules: { pinnedAt: null, pinRuleId: null, suppressed: 0 } as Answer["rules"],
    teachable: false,
  };
  const rec = (kind: Answer["kind"], evidence: EvidenceClass | null, passages: Passage[] = [], q: string | null = question) => ({
    question: q,
    kind,
    evidence,
    sourceIds: passages.map((p) => p.sourceId),
  });

  if (isCrisis(question)) {
    return {
      answer: {
        ...base,
        kind: "safety",
        evidence: null,
        lead:
          "It sounds like you might be going through something very hard. This is not something Echo of Me can help with, " +
          "and it will not answer in anyone's voice. Please reach out to a person now: someone you trust, or one of these free services.",
        resources: [...HELP_RESOURCES],
      },
      record: rec("safety", null, [], null),
    };
  }
  if (isIdentityQuestion(question)) {
    return {
      answer: {
        ...base,
        kind: "identity",
        evidence: null,
        lead: `No. I am Echo of Me, an AI interface. I am not ${author}, I cannot think or feel as them, and I never speak for them. I can only show you what ${author} chose to record and approve, and tell you when they did not record something.`,
      },
      record: rec("identity", null),
    };
  }

  const terms = (await db.query("select app.question_terms($1) as t", [question])).rows[0].t as string[];
  if (terms.length === 0) {
    return {
      answer: { ...base, kind: "empty_question", evidence: null, lead: "Please ask about a topic, a person or a time, for example “What did you learn from failing?”." },
      record: rec("empty_question", null),
    };
  }

  const rules = await loadRules(db, legacyId, terms);

  // A pinned item is the author's chosen answer: served as E1, read through citable_source, so a pin on
  // an item that is not approved (or not shared with this caller) is silently inactive.
  if (rules.pin && !rules.suppressed.has(rules.pin.memoryId)) {
    const pinned = await citableRowsForItem(db, legacyId, rules.pin.memoryId);
    if (pinned.length) {
      const passages = pinned.map(toPassage);
      return {
        answer: {
          ...base,
          kind: "grounded",
          evidence: "E1",
          lead: `In ${author}'s own words:`,
          passages,
          rules: { pinnedAt: rules.pin.createdAt, pinRuleId: rules.pin.id, suppressed: rules.suppressed.size },
          teachable: true,
        },
        record: rec("grounded", "E1", passages),
      };
    }
  }

  const all = (await db.query("select * from app.search_citable($1, $2, 12)", [legacyId, question])).rows as Row[];
  const rows = all.filter((r) => !rules.suppressed.has(r.memory_id));
  const appliedRules = { pinnedAt: null, pinRuleId: null, suppressed: new Set(all.filter((r) => rules.suppressed.has(r.memory_id)).map((r) => r.memory_id)).size };
  const evidence = classify(rows);
  if (evidence === "E3") {
    const adjacent = (await db.query("select memory_id, title, kind from app.adjacent_memories($1, 4)", [legacyId])).rows
      .filter((r) => !rules.suppressed.has(r.memory_id))
      .slice(0, 3)
      .map((r) => ({ memoryId: r.memory_id as string, title: r.title as string, kind: r.kind as string }));
    return {
      answer: {
        ...base,
        kind: "not_recorded",
        evidence,
        lead: `I don't have anything ${author} recorded about that.` + (adjacent.length ? ` Here are some things ${author} did record.` : ""),
        adjacent,
        rules: appliedRules,
        teachable: true,
      },
      record: rec("not_recorded", "E3"),
    };
  }
  const relevant = rows.filter((r) => isRelated(r) || isDirect(r));
  const passages = pickPassages(relevant, THRESHOLDS.maxPassages);
  return {
    answer: {
      ...base,
      kind: "grounded",
      evidence,
      lead:
        evidence === "E1"
          ? `In ${author}'s own words:`
          : `${author} did not record anything that answers this directly. Based on what they recorded, these may be related:`,
      passages,
      rules: appliedRules,
      teachable: true,
    },
    record: rec("grounded", evidence, passages),
  };
}

/**
 * The author asks a question as a future recipient might (rehearsal, module 04). Needs the
 * AI-processing consent, whose text covers answering questions from approved material.
 */
export async function rehearse(ctx: AuthContext, legacyId: string, rawQuestion: string): Promise<Answer> {
  const parsed = Question.safeParse(rawQuestion);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  const question = parsed.data;
  await enforceLimit(ctx, "ask", legacyId);
  return guarded(ctx, "answer.rehearse", { legacyId, targetType: "legacy", targetId: legacyId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    await assertConsents(db, ctx, ["ai_processing"]);
    const author = (await db.query("select author_display_name from legacy where id = $1", [legacyId])).rows[0].author_display_name as string;
    const { answer, record } = await composeAnswer(db, legacyId, question, author);
    const turnId = await recordTurn(db, ctx, legacyId, record.question, record.kind, record.evidence, record.sourceIds);
    return { ...answer, turnId };
  });
}

/**
 * A recipient asks about a legacy shared with them (slice 5). Same pipeline, but the database only lets
 * them see approved items shared with them. Needs the author's AI-processing consent. The question is
 * stored privately for the recipient; the author's activity log gets the fact and the source ids only.
 */
export async function recipientAsk(ctx: AuthContext, legacyId: string, rawQuestion: string): Promise<Answer> {
  const parsed = Question.safeParse(rawQuestion);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  const question = parsed.data;
  if (!UUID.safeParse(legacyId).success) throw new NotFoundError("legacy");
  await enforceLimit(ctx, "recipient_ask", legacyId);
  return guarded(ctx, "answer.recipient", { legacyId, targetType: "legacy", targetId: legacyId }, async (db) => {
    const m = (await db.query("select legacy_title, author_display_name from app.my_recipient_memberships() where legacy_id = $1", [legacyId])).rows[0];
    if (!m || !(await db.query("select app.is_member($1) as ok", [legacyId])).rows[0].ok) throw new NotFoundError("legacy");
    const author = m.author_display_name as string;
    if (!(await db.query("select app.author_has_consent($1, 'ai_processing') as ok", [legacyId])).rows[0].ok) {
      throw new PolicyError("answers_off", `${author} has not switched on answers to questions. You can still read what they shared with you.`);
    }
    const { answer, record } = await composeAnswer(db, legacyId, question, author);
    const { rows } = await db.query(
      `insert into recipient_turn (legacy_id, asked_by, question, kind, evidence, source_ids)
       values ($1, $2, $3, $4, $5, $6::uuid[]) returning id`,
      [legacyId, ctx.accountId, record.question, record.kind, record.evidence, record.sourceIds],
    );
    await audit(db, ctx, {
      action: "answer.recipient",
      legacyId,
      targetType: "recipient_turn",
      targetId: rows[0].id,
      detail: { kind: record.kind, evidence: record.evidence, sources: record.sourceIds.length, source_ids: record.sourceIds.join(",") || null },
    });
    return { ...answer, teachable: false, turnId: rows[0].id as string };
  });
}

// ------------------------------------------------------------------ author rules (slice 4, AC-11)

interface Rules {
  pin: { id: string; memoryId: string; createdAt: string } | null;
  suppressed: Set<string>;
}

async function loadRules(db: Queryable, legacyId: string, terms: string[]): Promise<Rules> {
  const { rows } = await db.query("select id, memory_id, action, created_at from app.answer_rules_for($1, $2::text[])", [legacyId, terms]);
  const pin = rows.find((r) => r.action === "pin");
  return {
    pin: pin ? { id: pin.id, memoryId: pin.memory_id, createdAt: new Date(pin.created_at).toISOString() } : null,
    suppressed: new Set(rows.filter((r) => r.action === "suppress").map((r) => r.memory_id as string)),
  };
}

/** The approved words (and original recordings) of one item, read through the citable view only. */
async function citableRowsForItem(db: Queryable, legacyId: string, memoryId: string): Promise<Row[]> {
  const { rows } = await db.query(
    `select source_type, source_id, memory_id, kind, provenance, title, text as quote, coalesce(length(text), 0) as full_length,
            media_asset_id, sensitivity, approved_at, version_no, 0 as matched, 0 as title_matched, 0 as query_terms
       from citable_source
      where legacy_id = $1 and memory_id = $2 and source_type in ('memory_version', 'media_asset')
      order by case source_type when 'memory_version' then 0 else 1 end, source_id`,
    [legacyId, memoryId],
  );
  return rows as Row[];
}

/** Reads one of the author's own rehearsal questions that can be taught (not safety or identity). */
async function teachableTurn(db: Queryable, legacyId: string, turnId: string): Promise<{ question: string; terms: string[] }> {
  if (!UUID.safeParse(turnId).success) throw new NotFoundError("question");
  const t = (await db.query(
    "select question, kind from rehearsal_turn where id = $1 and legacy_id = $2",
    [turnId, legacyId],
  )).rows[0];
  if (!t) throw new NotFoundError("question");
  if (!t.question || (t.kind !== "grounded" && t.kind !== "not_recorded")) {
    throw new ValidationError("Answers to this kind of question cannot be changed.");
  }
  const terms = (await db.query("select app.question_terms($1) as t", [t.question])).rows[0].t as string[];
  if (!terms.length) throw new ValidationError("This question has no topic words to attach an answer to.");
  return { question: t.question, terms };
}

async function assertCitableItem(db: Queryable, legacyId: string, memoryId: string) {
  if (!UUID.safeParse(memoryId).success) throw new NotFoundError("memory");
  const exists = (await db.query("select 1 from memory_item where id = $1 and legacy_id = $2", [memoryId, legacyId])).rowCount;
  if (!exists) throw new NotFoundError("memory");
  const citable = (await db.query(
    "select 1 from citable_source where legacy_id = $1 and memory_id = $2 and source_type = 'memory_version'",
    [legacyId, memoryId],
  )).rowCount;
  if (!citable) throw new ValidationError("Only an approved item can be pinned as an answer. Approve it first.");
}

async function insertPin(db: Queryable, ctx: AuthContext, legacyId: string, turn: { question: string; terms: string[] }, memoryId: string, via: string) {
  // One pin per question: a new pin replaces the old one, and un-suppresses the item for this question.
  await db.query("delete from answer_rule where legacy_id = $1 and terms = $2::text[] and (action = 'pin' or memory_id = $3)", [legacyId, turn.terms, memoryId]);
  const { rows } = await db.query(
    `insert into answer_rule (legacy_id, memory_id, question, terms, action, created_by)
     values ($1, $2, $3, $4::text[], 'pin', $5) returning id`,
    [legacyId, memoryId, turn.question, turn.terms, ctx.accountId],
  );
  await audit(db, ctx, { action: "answer.pin", legacyId, targetType: "answer_rule", targetId: rows[0].id, detail: { memory: memoryId, terms: turn.terms.length, via } });
  return rows[0].id as string;
}

/** "This is the answer": pin an approved item to this question (and to the same topic words in future). */
export async function pinAnswer(ctx: AuthContext, legacyId: string, turnId: string, memoryId: string): Promise<{ ruleId: string }> {
  return guarded(ctx, "answer.pin", { legacyId, targetType: "rehearsal_turn", targetId: turnId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const turn = await teachableTurn(db, legacyId, turnId);
    await assertCitableItem(db, legacyId, memoryId);
    return { ruleId: await insertPin(db, ctx, legacyId, turn, memoryId, "existing_item") };
  });
}

/** "Don't use this here": never use this item for this question (other questions are unaffected). */
export async function suppressForQuestion(ctx: AuthContext, legacyId: string, turnId: string, memoryId: string): Promise<{ ruleId: string }> {
  return guarded(ctx, "answer.suppress", { legacyId, targetType: "rehearsal_turn", targetId: turnId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const turn = await teachableTurn(db, legacyId, turnId);
    if (!UUID.safeParse(memoryId).success || !(await db.query("select 1 from memory_item where id = $1 and legacy_id = $2", [memoryId, legacyId])).rowCount) {
      throw new NotFoundError("memory");
    }
    await db.query("delete from answer_rule where legacy_id = $1 and terms = $2::text[] and memory_id = $3", [legacyId, turn.terms, memoryId]);
    const { rows } = await db.query(
      `insert into answer_rule (legacy_id, memory_id, question, terms, action, created_by)
       values ($1, $2, $3, $4::text[], 'suppress', $5) returning id`,
      [legacyId, memoryId, turn.question, turn.terms, ctx.accountId],
    );
    await audit(db, ctx, { action: "answer.suppress", legacyId, targetType: "answer_rule", targetId: rows[0].id, detail: { memory: memoryId, terms: turn.terms.length } });
    return { ruleId: rows[0].id as string };
  });
}

const CorrectionInput = z.object({
  kind: z.enum(["memory", "value_statement"]).optional().default("value_statement"),
  title: z.string().trim().max(160).optional(),
  body: z.string().trim().min(1, "Please write your answer.").max(20000),
});

/**
 * "Answer it yourself": the author writes what they would say. This becomes a new approved item in their
 * own words (P2) and is pinned to the question, in one transaction. No AI is involved.
 */
export async function answerYourself(
  ctx: AuthContext,
  legacyId: string,
  turnId: string,
  input: z.input<typeof CorrectionInput>,
): Promise<{ memoryId: string; ruleId: string }> {
  const p = CorrectionInput.safeParse(input);
  if (!p.success) throw new ValidationError(p.error.issues[0].message);
  return guarded(ctx, "answer.correct", { legacyId, targetType: "rehearsal_turn", targetId: turnId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const turn = await teachableTurn(db, legacyId, turnId);
    const title = (p.data.title || turn.question).slice(0, 160);
    const parsed = parseMemoryInput({ kind: p.data.kind, title, body: p.data.body, approve: true });
    const { memoryId } = await insertMemoryTx(db, ctx, legacyId, parsed);
    const ruleId = await insertPin(db, ctx, legacyId, turn, memoryId, "own_answer");
    return { memoryId, ruleId };
  });
}

export interface AnswerRuleView {
  id: string;
  action: "pin" | "suppress";
  question: string;
  memoryId: string;
  title: string;
  active: boolean;
  createdAt: string;
}

export async function listAnswerRules(ctx: AuthContext, legacyId: string): Promise<AnswerRuleView[]> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const { rows } = await db.query(
      `select r.id, r.action, r.question, r.memory_id, r.created_at, v.title, (i.approval = 'approved') as active
         from answer_rule r
         join memory_item i on i.id = r.memory_id
         join memory_version v on v.memory_id = i.id and v.version_no = i.current_version
        where r.legacy_id = $1 order by r.created_at desc`,
      [legacyId],
    );
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      question: r.question,
      memoryId: r.memory_id,
      title: r.title,
      active: r.action === "suppress" || r.active,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  });
}

export async function removeAnswerRule(ctx: AuthContext, legacyId: string, ruleId: string): Promise<void> {
  if (!UUID.safeParse(ruleId).success) throw new NotFoundError("rule");
  await guarded(ctx, "answer.rule_remove", { legacyId, targetType: "answer_rule", targetId: ruleId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const res = await db.query("delete from answer_rule where id = $1 and legacy_id = $2", [ruleId, legacyId]);
    if (!res.rowCount) throw new NotFoundError("rule");
    await audit(db, ctx, { action: "answer.rule_remove", legacyId, targetType: "answer_rule", targetId: ruleId });
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

