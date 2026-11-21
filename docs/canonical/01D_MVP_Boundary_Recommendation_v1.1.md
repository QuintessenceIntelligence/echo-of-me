# Echo of Me | 01D MVP Boundary Recommendation

| Field | Value |
|---|---|
| Document ID | 01D |
| Version | v1.1 |
| Date | 16 November 2026 |
| Status | **PROPOSED. Not approved.** Requires founder decisions at gates G1–G5 (R2 §3). Sensitive functions are excluded pending G6/G7. |
| Builds on | S-09 (modules 01–06 = MVP focus); S-04 §5.4 gates; S-06 §5.2 tiers and §5.5 Phase 3; S-07 gates |

## 1. Recommended MVP: "MVP-1 Governed Living Legacy"

**One sentence:** A living parent progressively captures and approves memories and values by text and voice. Echo of Me organises them. The parent rehearses how the AI answers future questions, with every answer cited, labelled and willing to say "not recorded". The parent can then share chosen material with a small number of **adult** recipients, all under auditable consent and permissions.

**Why this boundary:** It tests the two riskiest assumptions, (A-01) whether parents will capture enough and (RK-01) whether answers can be faithful. It does so without the three highest-exposure functions: minors, posthumous release and synthetic voice. Everything excluded stays on the roadmap (01C).

**The single traceable loop that must work end to end** [S-06 §5.5 Phase 3]:
> Author submits knowledge → reviews and approves it → an authorised recipient (or the author in rehearsal) asks a question → the system retrieves only permitted, approved sources → the response quotes or faithfully cites them, or admits that nothing is recorded.

## 2. In scope (by module)

| Module | MVP-1 scope |
|---|---|
| 01 Parent & Family Profiles | Author sign-up with MFA; legacy profile; family map; recipient records (minors as records only); invitations to adult recipients; trusted contact (record only); versioned purpose-specific consents |
| 02 Memory & Wisdom Vault | Text entries; in-browser audio recording/upload with **original preserved**; optional still images; transcription with author correction; memory and value-statement types; tags (AI-suggested, author-approved); per-recipient visibility; sensitivity flag; versions; full export (originals + JSON metadata) |
| 03 AI Conscience Engine | Policy filter → retrieval over approved content → evidence classification (E1/E2/E3) → grounded generation with citations → output validation; crisis policy; provider abstraction; evaluation harness |
| 04 Interaction Simulator | **Author rehearsal** (primary): ask, see evidence and gaps, pin/correct/suppress answers. **Adult-recipient Q&A** (pilot): labelled answers, source cards, original-audio playback, report an answer |
| 05 Guided Prompt Library | Editorially curated, versioned prompt set (themes in 01C); follow-up suggestions; gap prompts from rehearsal |
| 06 Dashboard, Permissions & Safeguards | Content approval; per-item permissions; consent management and withdrawal propagation; audit and transparency log (author-visible); deletion; export; report queue; least-privilege admin |

## 3. Explicitly excluded from MVP-1 (kept on the roadmap)

| Exclusion | Where it lives | Reopened by |
|---|---|---|
| Any direct use by minors | 01/04/06 later phases | G2 + legal/child-safety review |
| Live posthumous or death-triggered release (designed and tested in staging only) | 06, 10 | G3 + legal review |
| Synthetic voice / voice cloning; avatars; video persona | 04, 09 | G6 |
| Tier 3 adaptive persona; fine-tuning on author data | 03 | G1/G4 charter amendment |
| Feedback Loop (Module 07) | Phase 4 | G7 + RW-03 |
| Memory Canvas and Playful Identity imagery (08, 08A) | Phase 3 | Post-pilot |
| Video Canvas / The Echo Edit (09) | Phase 5 | G6 + rights review |
| Timed & Milestone Messages execution (10) | Phase 3 | Post-pilot; posthumous triggers under G3 |
| Cross-family/community trend mining | 05 | DR-021 privacy review |
| Video capture in the Vault | 02 | G5 |
| Family/friend contributor layer | DR-045 | Post-pilot |
| Native mobile apps; payments; multi-language | — | Post-validation |

> **Historical note (C-33, DR-049).** The original June 2025 checklist (S-17) planned to feature **one of Feedback Loop, Memory Canvas or Echo Edit** in the first release. This recommendation follows the current founder governance (S-09: modules 01–06 first) and does not declare the 2025 intent superseded. **Founder decision OQ-56:** if a differentiating module is wanted early, the lowest-risk option is **Memory Canvas (08)** as an **MVP-1.1** add-on after the faithfulness and isolation gates (H3, H5) pass. It needs no child data and no voice cloning, but it does need labelling, moderation and likeness consent.

## 4. MVP acceptance criteria (testable; detailed in docs 02/04/05)

| # | Criterion | Module |
|---|---|---|
| AC-01 | An author can create a legacy, add three recipients and record consents; each consent shows its text version and timestamp | 01 |
| AC-02 | Adding a recipient grants **no** access until the author explicitly shares content | 01/06 |
| AC-03 | An uploaded or recorded audio file is retrievable byte-identical after transcription, editing and export | 02 |
| AC-04 | Machine transcripts and AI tags are marked *unapproved* and are **never** cited in answers until the author approves them | 02/03 |
| AC-05 | Editing or deleting an approved item removes or replaces it in the retrieval index within a defined window (target ≤ 5 min) and in subsequent answers | 02/03 |
| AC-06 | Every answer carries exactly one evidence class (E1/E2/E3) plus citations for E1/E2; E3 answers contain no attributed belief | 03/04 |
| AC-07 | Questions outside the corpus produce an E3 response offering adjacent memories, not invented advice | 03 |
| AC-08 | A recipient can never retrieve, directly or by prompt manipulation, an item not shared with them or belonging to another legacy (adversarial suite: **0 failures**) | 03/06 |
| AC-09 | The interface states it is an AI interface to recorded material, persistently and when asked "are you my parent?" | 04 |
| AC-10 | Crisis-indicative questions route to a safe-messaging response with human-help resources and no "parent voice" | 03/04 |
| AC-11 | The author can pin, correct or suppress a rehearsal answer; pinned answers are served as E1 with the author's approval date | 04/06 |
| AC-12 | The author can export all originals and metadata in open formats and delete the legacy; deletion propagates to derived indexes | 02/06 |
| AC-13 | The audit log records access, sharing, consent changes and generated answers (with source IDs), minimising sensitive payloads | 06 |
| AC-14 | Core author and recipient flows meet WCAG 2.2 AA (target, to be confirmed in doc 02) | all |

## 5. Measurable hypotheses for the adult pilot

Threshold values are **PROPOSED starting points** for founder approval (OQ-15). They replace the historical metrics that S-04 §3.5 critiqued: ">15 min session time", "75% emotional accuracy" and "8/10 emotional value".

| ID | Hypothesis | Metric | Proposed threshold |
|---|---|---|---|
| H1 Capture | Parents will build a meaningful corpus | % of authors with ≥5 approved memories/values by week 3 | ≥ 60% |
| H2 Return | Capture becomes a habit | % of authors with a second capture session within 14 days | ≥ 50% |
| H3 Faithfulness | Answers do not misrepresent the author | % of answers judged by the author in **blinded review** to contain no unsupported attributed claim | ≥ 95% (and 0 severe fabrications) |
| H4 Abstention | The system admits gaps | % of out-of-corpus test questions correctly answered E3 | ≥ 90% |
| H5 Isolation | No leakage | Cross-legacy / unshared-item retrieval in adversarial tests | **0 (hard gate)** |
| H6 Comprehension | Users understand answer types | % of recipients who correctly identify an answer's evidence class in a quick check | ≥ 80% |
| H7 Value and trust | Worth paying for | % of authors who would recommend or pay (plus qualitative trust score) | ≥ 40% would pay (indicative) |
| H8 Safety | No harmful interactions | Unresolved P1 safety incidents | 0 |

**Go/no-go after the pilot:** proceed to Phase 3 only if H3, H5 and H8 pass **and** at least two of H1, H2 and H7 pass. Otherwise iterate on capture or positioning before adding modules.

## 6. Delivery gates (reconciled from S-04 §5.4 and S-06 §5.5)

| Gate | Exit criterion |
|---|---|
| 0 Discovery | 20–30 interviews (parents + adult recipients); target cohort; willingness-to-pay signal |
| 1 Trust & PRD | G1–G5 decided; docs 02, 04, 05 approved; legal review scoped |
| 2 Prototype | Traceable loop working on test data; evaluation harness reports H3/H4/H5 |
| 3 MVP-1 | AC-01 to AC-14 passing with test evidence; security review; export/restore tested |
| 4 Private adult pilot | 10–20 households, about 6 weeks, structured safety review |
| 5 Launch decision | Go/no-go criteria in §5 met; costs viable |

## 7. Decisions needed now (from R2 §3)
G1 product boundary · G2 adult cohort · G3 living-preview-only release · G4 AI output and data-use policy · G5 web-first platform and budget ceiling. Then the sensitive-function confirmations G6 (no synthetic voice in MVP) and G7 (Feedback Loop post-MVP).

## 8. Cost and schedule
Not estimated here. The historical **US$20,500–30,000 / 12–14 weeks** [S-01; S-02] is HISTORICAL (DR-033) and omits legal review, security testing, accessibility, evaluation, insurance, support and long-term custody [S-04 §2.5]. The re-estimate in ZAR/USD, with contingency, belongs in doc 06 once G5 sets the team model and budget ceiling (OQ-41).
