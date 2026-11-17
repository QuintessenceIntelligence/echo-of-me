# ADR-007a Provider-free grounded answers (slice 3 foundation)

| Field | Value |
|---|---|
| Status | **Accepted** (technical decision under DR-051; within R0, no vendor). ADR-007 (AI provider) remains **open** for the founder (DR-016). |
| Date | 17 November 2026 |
| Implements | Modules 03 and 04 (foundation): AC-04, AC-05, AC-06, AC-07, AC-08, AC-09, AC-10, AC-13 (part) for **author rehearsal** |
| Code | `db/migrations/0007_grounded_retrieval.sql`, `src/domain/rehearsal.ts`, `src/domain/safety.ts`, `app/legacy/rehearse/` |

## Context
The answer policy (DR-022, DR-023) needs retrieval over approved material, evidence classes and abstention. Choosing an AI provider is a vendor and cost decision for the founder (DR-016, DR-054 R0). The governance-critical parts can be built and tested without any model.

## Decisions
1. **Single retrieval entry point.** `app.search_citable(legacy, question)` reads only the `citable_source` view (ADR-006), runs as the caller (RLS), and builds the text vector at query time. There is no separate index, so edits, withdrawals and deletions take effect on the next question (AC-05 window = 0). Revisit when corpora grow (a generated tsvector column or pgvector, still fed only from the view).
2. **Pipeline order** (01B §4.6): crisis screen → identity screen → topic words → search → evidence class → extractive composer → audit.
3. **Evidence classes (lexical, PROPOSED thresholds):** E1 when one text source contains ≥ 60 % of the question's topic words (and at least 2, or all if fewer); E2 when some approved source overlaps (≥ 2 words or ≥ 34 %); otherwise E3. A recording's title alone never makes E1. Lexical matching misses paraphrases; this fails safe (E3, never an invented answer).
4. **Extractive composer, no generation.** E1 quotes the author's approved words verbatim (whole text ≤ 600 characters, otherwise `ts_headline` fragments, which are substrings of the source); E2 shows related excerpts framed as "did not record anything that answers this directly"; E3 says "I don't have anything [author] recorded about that" and offers up to three non-sensitive approved items. Every passage carries provenance, title, version and approval date; recordings are offered as the original (P1).
5. **Always-on disclosure** that this is an AI interface and not the author (AC-09); identity questions get a fixed plain answer.
6. **Crisis screen** (AC-10): pattern list ⚕ (clinical review required) → no parent voice, no sources, verified SA help lines; the question text is **not stored** (database constraint).
7. **Rehearsal history** `rehearsal_turn` (owner-only, immutable rows, clearable) keeps question, kind, evidence and source ids for slice 4 (pin/correct/suppress). The audit log keeps kind, evidence and source ids, never the question.
8. **Consent:** answering requires the AI-processing consent, whose text covers answering from approved material.

## Consequences
- When a provider is approved (ADR-007), a model may replace step 4 only; it must keep the same evidence rules, cite only passages returned by `search_citable`, and pass the same tests plus attribution checks.
- Recipient-facing answers wait for slice 5 (sharing grants) and must add per-recipient filtering on top of this function.
