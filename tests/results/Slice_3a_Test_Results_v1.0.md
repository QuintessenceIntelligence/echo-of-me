# Echo of Me | Slice 3a test results (provider-free grounded answers, author rehearsal)

| Field | Value |
|---|---|
| Version | v1.0 |
| Run date | 17 November 2026, ~06:20 SAST |
| Build | branch `slice-3a` (merged to `main`) |
| Environment | Local only: Node 22, PostgreSQL 16.15, Next.js 16.4 production build, headless Chrome. **No AI model or external service used. Synthetic data only.** |
| Result | **69/69 unit and database tests** (16 new) · **8/8 slice-3a browser steps** · slice-1 17/17 and slice-2 23/23 browser regressions pass · **0 axe violations** on 4 new screen states · **4/4 deliberate breakages detected** |

## 1. Acceptance criteria (author rehearsal scope)
| Criterion | Evidence | Status |
|---|---|---|
| AC-04 only approved material | Drafts, unapproved machine transcripts (P6) never surface, including when named or asked for by an injection-style question; browser: draft "Secret recipe" never shown | **Met** |
| AC-05 changes apply | Edit → old words gone from the next answer; re-approve → new version cited; delete → gone | **Met** (window 0, no separate index) |
| AC-06 one evidence class + citations | Every answer has exactly one kind/class; E1/E2 passages carry provenance, title, version, approval date; quotes verified verbatim against approved text (incl. long-text fragments) | **Met** |
| AC-07 out-of-corpus → E3 + adjacent | Evaluation sample: 5/5 out-of-corpus questions abstained (H4 sample), adjacent items offered, sensitive items never offered | **Met on the sample** (larger evaluation set needed for H4) |
| AC-08 isolation | Another family: rehearse/history refused as not found; raw SQL search, adjacent and history return 0 rows; cannot insert turns; SQL-looking input treated as text | **Met for rehearsal** (recipient path is slice 5) |
| AC-09 AI identity | Disclosure on every answer; "Are you really my dad/gran?", "Is this really you?", "are you an AI", "Who am I talking to?" → fixed identity answer | **Met** |
| AC-10 crisis | 4 crisis phrasings → help lines (SADAG 0800 567 567, LifeLine 0861 322 322, 112, 10111/10177; verified 17 Nov 2026), no sources, question not stored (constraint) | **Met** ⚕ clinical review of wording and patterns still required |
| AC-13 answers audited | `answer.rehearse` with kind, evidence and source ids; no question text in the log | **Met for rehearsal** |
| AC-14 accessibility | axe 0 violations: empty, E1 answer, E3 answer, history | Automated only |

## 2. Evaluation set (10 questions, synthetic corpus of 7 approved items + 1 draft + 1 P6 transcript)
All 10 classified as expected: 4 × E1, 1 × E2 ("fail an exam" vs a driving-test memory), 5 × E3. False E3 on paraphrased questions is a known, accepted limitation of lexical matching.

## 3. Mutation checks
| Breakage | Tests failing |
|---|---|
| Crisis screen disabled | 1 |
| Search function run with owner rights (bypasses RLS) | 1 |
| Any overlap treated as a direct answer | 4 |
| Identity screen disabled | 1 |

## 4. Known limitations
- Lexical matching only (no synonyms or paraphrase); English stemming only.
- Pin/correct/suppress (AC-11) not built yet (slice 4); the history table is ready for it.
- Not yet available to recipients (needs sharing, slice 5).
- Crisis patterns are English and incomplete ⚕; help lines are South African only.
