import { z } from "zod";
import { withActor } from "../server/db";
import { audit, guarded } from "./audit";
import type { AuthContext } from "./auth";
import { NotFoundError } from "./errors";
import { ownedLegacy } from "./onboarding";

/**
 * Module 05, Guided Prompt Library (ADR-010): an editorial, versioned set of questions that help authors
 * remember what they might otherwise leave out, plus "gaps" — practice questions that got "not recorded".
 * Editorial only: nothing is learned from other families (DR-021) and no AI is involved.
 */

export const THEMES = ["values", "relationships", "adversity", "mistakes", "self_worth", "family_traditions", "future_milestones"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABEL: Record<Theme, string> = {
  values: "Values",
  relationships: "Relationships",
  adversity: "Hard times",
  mistakes: "Mistakes and lessons",
  self_worth: "Self-worth",
  family_traditions: "Family traditions",
  future_milestones: "Future milestones",
};

export interface PromptView {
  id: string;
  theme: Theme;
  text: string;
  hint: string | null;
  gentle: boolean;
  answeredBy: { memoryId: string; title: string }[];
  dismissed: boolean;
}

const PROMPT_ID = z.string().regex(/^[a-z_]+-[0-9]{2}$/);

export async function listPrompts(ctx: AuthContext, legacyId: string): Promise<PromptView[]> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const { rows } = await db.query(
      `select p.id, p.theme, p.text, p.hint, p.gentle,
              (d.prompt_id is not null) as dismissed,
              coalesce((select json_agg(json_build_object('memoryId', i.id, 'title', v.title) order by i.created_at)
                          from memory_item i join memory_version v on v.memory_id = i.id and v.version_no = i.current_version
                         where i.legacy_id = $1 and i.prompt_id = p.id and app.owns_legacy(i.legacy_id)), '[]') as answered
         from prompt p
         left join prompt_dismissal d on d.prompt_id = p.id and d.legacy_id = $1
        where p.retired_in is null
        order by array_position($2::text[], p.theme::text), p.position`,
      [legacyId, THEMES],
    );
    return rows.map((r) => ({ id: r.id, theme: r.theme, text: r.text, hint: r.hint, gentle: r.gentle, answeredBy: r.answered, dismissed: r.dismissed }));
  });
}

export async function getPrompt(ctx: AuthContext, promptId: string): Promise<{ id: string; theme: Theme; text: string; hint: string | null; gentle: boolean } | null> {
  if (!PROMPT_ID.safeParse(promptId).success) return null;
  return withActor(ctx.accountId, async (db) => {
    const r = (await db.query("select id, theme, text, hint, gentle from prompt where id = $1 and retired_in is null", [promptId])).rows[0];
    return r ? { id: r.id, theme: r.theme, text: r.text, hint: r.hint, gentle: r.gentle } : null;
  });
}

export async function setPromptDismissed(ctx: AuthContext, legacyId: string, promptId: string, dismissed: boolean): Promise<void> {
  if (!PROMPT_ID.safeParse(promptId).success) throw new NotFoundError("prompt");
  await guarded(ctx, dismissed ? "prompt.dismiss" : "prompt.restore", { legacyId }, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    if (!(await db.query("select 1 from prompt where id = $1", [promptId])).rowCount) throw new NotFoundError("prompt");
    if (dismissed) {
      await db.query("insert into prompt_dismissal (legacy_id, prompt_id) values ($1, $2) on conflict do nothing", [legacyId, promptId]);
    } else {
      await db.query("delete from prompt_dismissal where legacy_id = $1 and prompt_id = $2", [legacyId, promptId]);
    }
    await audit(db, ctx, { action: dismissed ? "prompt.dismiss" : "prompt.restore", legacyId, detail: { prompt: promptId } });
  });
}

/** Up to `n` unanswered, not hidden prompts after this one in the same theme (follow-up suggestions). */
export async function nextPrompts(ctx: AuthContext, legacyId: string, promptId: string, n = 3): Promise<{ id: string; text: string; gentle: boolean }[]> {
  if (!PROMPT_ID.safeParse(promptId).success) return [];
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const { rows } = await db.query(
      `select p.id, p.text, p.gentle from prompt p, prompt cur
        where cur.id = $2 and p.theme = cur.theme and p.id <> cur.id and p.retired_in is null
          and not exists (select 1 from memory_item i where i.legacy_id = $1 and i.prompt_id = p.id)
          and not exists (select 1 from prompt_dismissal d where d.legacy_id = $1 and d.prompt_id = p.id)
        order by (p.position < cur.position), p.position limit $3`,
      [legacyId, promptId, Math.min(Math.max(n, 1), 10)],
    );
    return rows.map((r) => ({ id: r.id, text: r.text, gentle: r.gentle }));
  });
}

export interface GapView {
  question: string;
  askedAt: string;
  times: number;
}

/**
 * "Gaps": the author's own practice questions whose latest answer was "not recorded" and that they have not
 * pinned an answer to since. Grouped by topic words, so rephrasings of one question appear once.
 */
export async function gapQuestions(ctx: AuthContext, legacyId: string, limit = 20): Promise<GapView[]> {
  return withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const { rows } = await db.query(
      `with t as (
         select question, kind, created_at, app.question_terms(question) as terms
           from rehearsal_turn where legacy_id = $1 and question is not null and kind in ('grounded', 'not_recorded')
       ), latest as (
         select distinct on (terms) terms, question, kind, created_at, count(*) over (partition by terms) as times
           from t where cardinality(terms) > 0 order by terms, created_at desc
       )
       select question, created_at, times from latest l
        where l.kind = 'not_recorded'
          and not exists (select 1 from answer_rule r where r.legacy_id = $1 and r.terms = l.terms and r.action = 'pin')
        order by created_at desc limit $2`,
      [legacyId, Math.min(Math.max(limit, 1), 100)],
    );
    return rows.map((r) => ({ question: r.question, askedAt: new Date(r.created_at).toISOString(), times: Number(r.times) }));
  });
}
