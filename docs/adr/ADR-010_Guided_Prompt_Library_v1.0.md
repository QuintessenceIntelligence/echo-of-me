# ADR-010 Guided prompt library (module 05)

| Field | Value |
|---|---|
| Status | **Accepted** (technical decision under DR-051; DR-019 concept, DR-021 working default "editorial only") |
| Date | 18 November 2026 |
| Implements | Module 05 MVP scope (01C/01D): editorial, versioned prompt set; follow-up suggestions; gap prompts from rehearsal. No cross-family mining |
| Code | `db/migrations/0011_guided_prompts.sql`, `db/seed/0002_prompts_v0.1.sql`, `src/domain/prompts.ts`, `app/legacy/prompts/` |

## Decisions
1. **Editorial prompts in the database**, global and non-personal: 35 prompts, 7 themes from 01C (values, relationships, hard times, mistakes, self-worth, family traditions, future milestones). Set **v0.1-draft**, written by Claude for the founder's editorial review. Read-only to the app; prompt text cannot be rewritten (trigger). Changes retire a prompt (`retired_in`) and add a new one, so items keep pointing at the exact wording they answered.
2. **Gentle prompts** (loss, fear, hard times) are flagged and always shown with "skip whenever you like"; prompts address the author, never children.
3. **Answering a prompt** pre-fills a new item and records `memory_item.prompt_id` (exported as `answered_prompt`). After saving, the item shows the next unanswered prompts in the same theme (follow-ups).
4. **Hide / show again** per legacy (`prompt_dismissal`, owner RLS).
5. **Gaps** come from the author's own practice: questions whose latest answer was "not recorded" and that have no pinned answer, grouped by topic words. Recipients' questions are never used (they are private to recipients).
6. No AI, no third party, no data from other families (DR-021, DR-054).

## Open for the founder
- Editorial review of the prompt wording (v0.1-draft) and whether to add themes (for example work, faith, money as its own theme).
