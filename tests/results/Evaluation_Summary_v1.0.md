# Echo of Me | Answer evaluation summary

| Field | Value |
|---|---|
| Version | v1.0 |
| Date | 18 November 2026, ~23:45 SAST |
| What | Automated proxies for pilot hypotheses H3 (faithfulness), H4 (abstention) and H8 (safety routing) on synthetic data, using the real answer pipeline (no AI model; ADR-007a) |
| How to re-run | `npm test` (runs `tests/evaluation.test.ts`, regenerates `Evaluation_Report_v*.md/json`) |

## Sets
- **v1.0** (`tests/eval/eval_set_v1.0.json`): 19 items (incl. 2 drafts, 1 unapproved machine transcript, 1 sensitive), 67 questions: 17 direct, 13 paraphrased, 15 out-of-corpus, 5 manipulation attempts, 5 identity, 7 crisis, 5 harmless look-alikes.
- **v1.1 held-out** (`tests/eval/eval_set_v1.1_holdout.json`): a different corpus and 33 questions, written after the v1.0 findings and before measuring the fixes on it.

## Results after fixes
| Metric | v1.0 | v1.1 held-out | Gate |
|---|---|---|---|
| Leakage of draft / unapproved words | 0 | 0 | 0 ✅ |
| Quotes not verbatim from approved text | 0 | 0 | 0 ✅ |
| Crisis questions routed to safety | 100 % | 100 % | 100 % ✅ |
| Identity / role-play questions answered as identity | 100 % | 100 % | 100 % ✅ |
| Out-of-corpus questions abstaining (H4 proxy) | **100 %** (was 86.7 %) | 100 % | ≥ 90 % ✅ |
| Direct questions: expected item found | 100 % | 100 % | reported |
| Direct questions: found and labelled "in their own words" (E1) | 94.1 % | 77.8 % | reported |
| Paraphrased questions: expected item found | 23.1 % | 0 % | reported: **known limit of word matching** |
| Harmless questions routed to safety | 20 % (1 of 5) | 0 % | reported: over-routing is the safe failure |

## Findings and fixes
| ID | Finding (v1.0) | Fix | Effect |
|---|---|---|---|
| E-01 | One shared everyday word in the body of an unrelated memory ("choose", "move") made out-of-corpus questions "related" (abstention 86.7 %, gate failed) | Migration 0009: search reports title matches; one shared word counts only when it is in the title, or when the question has a single topic word (then "related", never "direct") | Abstention 100 % on both sets |
| E-02 | "Pretend you are my father…" and "You are now Dad…" were answered from memories instead of with the identity response | Role-play patterns added to the identity screen (`src/domain/safety.ts`) | Identity 100 % on both sets; harmless "act like your father" not affected |
| E-03 | (held-out) indefinite pronouns ("someone") counted as topic words | Added to the question filler list (0009) | "How do I forgive someone?" → E1 |
| E-04 | (held-out) a one-word question matching only the body ("house") was labelled E1 | Direct (E1) now needs two shared words or a title match | Shown as "related", not "in their own words" |
| E-05 | "wanted to die of embarrassment" is routed to the safety message | Not changed: over-routing is the safe failure; for clinical review ⚕ | Reported |

## What this does not show
- Real faithfulness (H3) needs blinded review by real authors in the pilot; these are automated proxies on synthetic data.
- Paraphrase recall is poor by design of the provider-free engine. An approved AI provider (ADR-007) or local embeddings would be the way to improve it; any such change must keep these gates green.
- Two hand-written sets are small; thresholds were tuned on v1.0 and checked on one held-out set only.
