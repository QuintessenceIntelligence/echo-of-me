# Echo of Me | Test results: legacy deletion (AC-12) and guided prompts (module 05)

| Field | Value |
|---|---|
| Version | v1.0 |
| Run date | 19 November 2026, ~00:40 SAST |
| Environment | Local only: Node 22, PostgreSQL 16, Next.js 16.4 production build, headless Chrome. Synthetic data only. |
| Result | **106/106 unit and database tests** (9 new) · browser: deletion 6/6, prompts 8/8, and every earlier walkthrough re-run (slice 1 17/17, slice 2 23/23, slice 3a 8/8, slice 4 10/10, slice 5 17/17): **89/89 steps, 0 axe violations** |

## Legacy deletion (AC-12)
| Check | Evidence |
|---|---|
| Guards | Needs second factor and the exact title; other authors and recipients refused (as "not found"); refusals logged |
| Completeness | After deletion: 0 rows in all 15 legacy tables; the legacy's file folder removed; recordings 404; recipients lose membership and access; citable view empty |
| Kept on purpose | Consent history and the activity log (ids and counts only; no content found in it) |
| No collateral | Another family's items, files and recipient access untouched; the author can start a new legacy |
| Export first | Export now includes who each item is shared with, answer rules, practice questions and reports received (not recipients' own questions) |

## Guided prompts (module 05)
| Check | Evidence |
|---|---|
| Library | 35 active prompts in 7 themes; heavy ones marked gentle; read-only to the app; text immutable even for the database owner |
| Answering | Item linked to its prompt; prompt shown as answered; follow-ups skip answered and hidden prompts; link exported; unknown or retired prompts refused |
| Hide / show | Per legacy; other families cannot see or change it |
| Gaps | Unanswered practice questions listed once per topic (with count), removed when answered (pin or a new matching item); crisis questions never appear; other families refused |

## Known limitations
- Prompt wording is draft editorial content (v0.1) for founder review.
- "Gaps" depend on the author using the practice page and on topic-word matching.
