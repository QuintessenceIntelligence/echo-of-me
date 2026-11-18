# Echo of Me | Slice 4 test results (rehearsal answer rules)

| Field | Value |
|---|---|
| Version | v1.0 |
| Run date | 18 November 2026, ~23:00 SAST |
| Build | branch `slice-4` (merged to `main`) |
| Environment | Local only: Node 22, PostgreSQL 16, Next.js 16.4 production build, headless Chrome. No AI model, no external service, synthetic data only. |
| Result | **80/80 unit and database tests** (11 new) · **10/10 slice-4 browser steps** · slice-3a browser regression 8/8 · **0 axe violations** · mutation checks: 3 of 4 detected; the 4th has no observable effect because two other layers already block it (see §3) |

## 1. Acceptance criterion AC-11
| Requirement | Evidence | Status |
|---|---|---|
| Pin | Pinned item served as E1 "In their own words" with "You pinned this answer on <date>"; applies to the same topic words in another order; replaces an earlier pin; can turn an E3 into E1 | **Met** |
| Correct | "Answer it yourself": approved P2 item created and pinned in one transaction; the next answer quotes it verbatim (browser and unit) | **Met** |
| Suppress | Item hidden for that question only (still used elsewhere); hidden count shown; also removed from "things they did record" | **Met** |
| Safety | A pin on an item that returns to draft is inactive and never serves the draft words; only approved items can be pinned; rules die with the item; safety and identity questions cannot be taught | **Met** |
| Isolation | Another family cannot pin, suppress, correct, list or remove rules, even with a valid question id; cannot insert rules directly (RLS); a pin cannot point across legacies (foreign key); an author's two legacies keep separate rules | **Met** |
| Audit | Rule changes logged with ids and counts, no question text; rows immutable | **Met** |

## 2. Browser walkthrough (10/10)
Unknown question → "Answer it yourself" → same question now E1 with the author's exact words and the pin date · "Don't use this for this question" hides the item and shows the hidden count · pinning an adjacent item makes it the direct answer · rules list shows 2 pins + 1 hidden item · removing a rule restores the item · activity log records the changes without question text. axe: 0 violations (pinned answer, rules list).

## 3. Mutation checks
| Breakage | Tests failing |
|---|---|
| Pinned answer read from the latest version instead of the approved citable view | 1 |
| Suppression not applied | 1 |
| Safety/identity questions treated as teachable | 1 |
| Rule lookup not limited to the legacy | 0: no observable effect. Row security already limits rules to the author's own legacies, and the pinned item is looked up within the current legacy, so a rule from another legacy can never apply. Kept as defence in depth; a two-legacy test documents the behaviour. |

## 4. Known limitations
- Topic-word keys: a paraphrase with different words does not pick up the rule (it then gets the normal answer, never a wrong pinned one).
- Pinned long texts are shown in full.
