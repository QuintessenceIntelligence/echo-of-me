# ADR-008 Rehearsal answer rules: pin, suppress, answer it yourself (slice 4)

| Field | Value |
|---|---|
| Status | **Accepted** (technical decision under DR-051; implements the working default DR-030) |
| Date | 18 November 2026 |
| Implements | AC-11 (pin, correct, suppress; pinned answers served as E1 with the author's date); module 04 author rehearsal |
| Code | `db/migrations/0008_answer_rules.sql`, `src/domain/rehearsal.ts` (rules section), `app/legacy/rehearse/` |

## Decisions
1. **Rules are keyed by the question's topic words** (`app.question_terms`, sorted, distinct), not by exact text. "How should I handle failing an exam?" and "failing an exam, how should I handle it?" share a rule; different topic words do not. Simple, explainable, deterministic.
2. **Rules point at items, never at text.** A pin names an item; the words served always come from `citable_source`. If the pinned item returns to draft, the pin is inactive and shown as such; deleting the item deletes its rules (composite foreign key).
3. **One pin per question**; a new pin replaces the old one. Pinning an item removes a suppression of the same item for that question. Suppression applies to that question only and also hides the item from "things they did record".
4. **"Answer it yourself" = correction without AI.** The author's own words become a new approved item (P2, value statement by default, titled with the question) and are pinned, in one transaction. This satisfies "correct" without ever editing quoted text or generating words.
5. **Only teachable questions:** rules can be made only from the author's own grounded or not-recorded practice questions (never safety or identity turns), identified by the stored turn, so the question text cannot be forged.
6. **Rows are immutable** (change = remove + add), owner-only RLS, audited (`answer.pin`, `answer.suppress`, `answer.correct`, `answer.rule_remove`) with ids and counts only.

## Consequences
- When recipients can ask questions (slice 5), the same rules apply to their answers, limited to items shared with them.
- If topic-word matching proves too narrow or too broad in the pilot, the key can move to a normalised question embedding without changing the rule semantics.
