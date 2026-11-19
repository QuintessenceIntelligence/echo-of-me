# 04 | AI Conscience and Memory Intelligence

| Field | Value |
|---|---|
| Document | 04 (required build document) |
| Version | v1.0 |
| Date | 19 November 2026 |
| Status | §1–§9 describe what is **built and tested** (no AI model is used anywhere yet). §10–§12 are the **PROPOSED** design for generated answers, which needs the founder's AI-provider decision (ADR-007, DR-016) before anything is built. |
| Read with | ADR-006 (capture and provenance), ADR-007a (provider-free answers), ADR-008 (answer rules), `canonical/build/Evaluation_Summary_v1.0.md`, doc 05 §8 |

**Non-negotiable.** Echo of Me preserves a person's recorded words, recordings, lessons and values. It does not preserve or simulate a consciousness. It never invents memories or opinions and never speaks *as* the person. Every answer says what it is based on, or says that nothing was recorded.

---

## 1. Decisions in force
| ID | Decision | Status |
|---|---|---|
| DR-022 | Source-grounded answers from the person's own approved material (retrieval first); **no fine-tuning** in the MVP; provider-portable | CONFIRMED FOR MVP |
| DR-023 | Citations on grounded answers; **no unsupported guessing**; AI identity always disclosed | CONFIRMED FOR MVP (principle) |
| DR-024 | Tier 1 Interactive Memory + constrained Tier 2 Values-Grounded Guidance | CONFIRMED FOR MVP |
| DR-028 | No voice cloning | CONFIRMED FOR MVP |
| DR-030 | The author can review, correct, pin or suppress answers while practising | PROPOSED (built as working default) |
| DR-021 | No content from one family is used for another or for model training | PROPOSED (built as working default) |
| DR-044 | "Teach your Echo" is product language, never presented as training or as the AI becoming the person | PROPOSED |
| DR-016 / ADR-007 | Which AI provider, if any | **UNRESOLVED (founder)** |

## 2. What is built today (Tier 1, extractive)
- Answers **quote** the person's approved words verbatim, cite the item, version and approval date, and label the evidence. Nothing is paraphrased or generated.
- Tier 2 (values-grounded guidance that combines several items into advice) needs generation and therefore ADR-007. Until then, a question about guidance returns the person's own relevant value statements as quotes.

## 3. Guided capture (ingestion)
| Step | Built | Notes |
|---|---|---|
| Write, record in the browser, upload audio or photos | ✅ | Originals byte-identical with SHA-256 (P1); files over 3 MB sent in pieces (ADR-016) |
| Guided prompts | ✅ | 35 editorial prompts in 7 themes, follow-up prompts, and "gaps" from practice questions that found nothing (ADR-010); draft wording ⚕/editorial review |
| Transcription | Partly | Authors can type a transcript (P3 once approved). A slot for machine transcripts exists (P6, never citable until the author approves) but **no transcription provider** is connected (ADR-007/008) |
| Themes / tags | ✅ | Keyword suggestions (not AI, local) shown as unapproved; the author accepts or rejects |
| Automatic extraction of facts or values | ✗ | Not built; would need a provider and would land as P6 suggestions for author approval |

## 4. Provenance and evidence
| Provenance | Meaning | Can be quoted |
|---|---|---|
| P1 | Original recording or photo | Yes, when the item is approved |
| P2 | The author's own written words | Yes (current approved version) |
| P3 | Transcript the author approved | Yes |
| P4 | AI summary the author approved | Reserved (needs ADR-007) |
| P5 | Family contributor's words, labelled as theirs | Reserved (DR-045, post-MVP) |
| P6 | Unapproved machine output | **Never** |

The **`citable_source` database view** is the only thing the answer engine can read; row-level security decides what each caller (author or a specific recipient) can see through it.

| Evidence | Shown as | Rule (as built) |
|---|---|---|
| E1 | "In their own words" | Strong word overlap including the title or ≥ 2 topic words; not media-only |
| E2 | "Related, not a direct answer" | Weaker but real overlap |
| E3 | "Not recorded" | Nothing relevant; suggests adjacent memories and, for authors, offers to record an answer |

## 5. Retrieval and citation (as built, ADR-007a / ADR-008)
1. **Crisis screen** first: self-harm or suicide language returns South African help lines; the question is not searched and not stored (⚕ C-01).
2. **Identity screen**: "are you really my dad?", "pretend to be my mother" and similar are answered with a plain statement that this is an AI interface quoting recorded words.
3. Topic words are extracted (filler words removed).
4. **Author rules** for those topic words: a pinned item is served first (E1, with the date it was pinned); suppressed items are excluded; "answer it yourself" creates a new approved value statement and pins it.
5. **Search** over `citable_source` with PostgreSQL full-text search; up to 3 passages; quotes cut with `ts_headline` from the approved text only.
6. Evidence class E1/E2/E3 as in §4; citations carry item, version, approval date.
7. The turn is recorded privately (authors: practice history; recipients: their own questions, never visible to the author; a report shows the question only if the recipient chooses to include it).

## 6. Safety behaviours
- **Disclosure** on every answer surface: Echo of Me is an AI interface, not the person.
- **No first person:** answers never say "I" for the person; quotes are clearly quotes.
- **Prompt injection:** there is no model to instruct; stored text is only ever quoted. Manipulation questions are in the evaluation set.
- **Sensitive items** need the author's extra confirmation before they can be shared; nothing reaches recipients unless approved and shared.
- **Reports:** recipients can report an answer (not what they meant, upsetting, wrong or outdated); reports go to the author.
- **Over-routing is the safe failure:** a harmless phrase that looks like crisis language gets the safety message (E-05, ⚕).

## 7. Changed views and contradictions
- **Built:** every edit creates a new version; only the **current approved** version can be quoted, and editing returns an item to draft until re-approved (recipients lose it in the meantime). Older versions remain in the author's export, never in answers. Answers show approval dates, and the author can pin the definitive answer for a question.
- **PROPOSED:** when two approved items on the same topic disagree, show both with their dates and a neutral note ("recorded at different times"), never choose between them; offer the author a "this replaces my earlier view" link that suppresses the older item for those topics.

## 8. Retrieval vs fine-tuning (why RAG, DR-022)
| Need | Retrieval over approved items | Fine-tuning on the person's data |
|---|---|---|
| Show the exact source | Yes, by construction | No |
| Delete or unshare immediately | Yes (next question) | No: the words stay in model weights |
| Different recipients see different things | Yes (database access rules) | Very hard |
| Never invent | Enforceable (quote or abstain) | Not enforceable |
| Cost and lock-in | Low; provider-portable | High; tied to one model |

## 9. Evaluation (measured, synthetic data)
Two sets (100 questions incl. a held-out set). Gates: 0 leakage of draft or unapproved words, 0 non-verbatim quotes, 100 % crisis and identity routing, ≥ 90 % abstention on out-of-corpus questions: **all green on both sets**. Reported, not gated: paraphrased questions find the right item only 23 % / 0 % of the time, a known limit of word matching that errs towards "not recorded". Real faithfulness (H3) needs blinded review by real authors in the pilot. Details: `canonical/build/Evaluation_Summary_v1.0.md`.

## 10. Generated answers: PROPOSED design (needs ADR-007)
- **Composer behind an interface** (`AnswerComposer`): input = the caller's question + only the passages the database already returned for *this caller*; output = structured `{text, citations[], evidence}`. Swappable provider; a provider-free extractive composer remains the fallback.
- **Voice:** third person about the person ("Your father wrote that…"), labelled as Echo of Me's summary; never first person as the parent; never new advice the person did not express.
- **Post-check before showing anything:** every claim attributed to the person must map to a cited passage (string-level support check); unsupported sentences are removed; if little remains, fall back to quotes or "not recorded".
- **Still screened first:** crisis and identity screens run before any provider call; crisis text is never sent to a provider.
- **Data rules for any provider** (⚖ L-12): no training on our data, minimal or zero retention, region and transfer basis recorded (s 72), a written agreement; only the passages needed for one answer are sent, never the whole legacy.
- **Paraphrase recall:** embeddings (pgvector) computed either by a provider or by a small local model, stored per item version, deleted with the item; retrieval stays inside the same access rules.
- **Evaluation gates stay** and gain: a faithfulness check per generated sentence, human review of a sample, and a regression run before any model or prompt change.
- **Cost control:** per-account rate limits already in place (ADR-012); a per-legacy monthly cap would be added with any paid provider (DR-054: R0 today).

## 11. Options for the founder's ADR-007 decision (no prices stated: to be researched with dated sources)
1. **Stay provider-free for the pilot** (today's behaviour): no cost, no third party; weaker on paraphrased questions; no automatic transcription.
2. **Transcription only** through a provider, results as P6 for author approval; answers stay extractive.
3. **Generated summaries (Tier 2)** with the design in §10.
4. **Local models** (embeddings and/or transcription) on our own infrastructure: no third party, but hosting cost and engineering effort.

## 12. Open items
ADR-007 provider choice (founder); clinical review of crisis and bereavement wording (⚕ C-01, C-02); editorial review of the prompt set; "changed view" handling (§7 PROPOSED); pilot measurement of H3/H4 with real authors (needs approval ⚖ L-10).
