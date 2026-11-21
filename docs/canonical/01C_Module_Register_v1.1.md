# Echo of Me | 01C Authoritative Module Register

| Field | Value |
|---|---|
| Document ID | 01C |
| Version | v1.1 |
| Date | 16 November 2026 |
| Status | CANONICAL. The module **catalogue** is CONFIRMED (DR-011). Phase and MVP placement are PROPOSED (01D). |
| Consolidates | S-05 §3.4 module register; module lists in S-01 §4, S-02 §7, S-03 §7, S-04 §2.2, S-06 §2.2; S-17 checklist (sources retained unchanged, DR-047) |
| Rule | Modules may not be removed, renamed, merged away or silently discarded (S-09). A renaming proposal requires a DR entry and founder approval. |

## 1. Register summary

| # | Canonical name (S-09) | Type | Concept status | Implementation | Proposed phase | MVP-1? |
|---|---|---|---|---|---|---|
| **01** | Parent & Family Profiles | Foundation | CONFIRMED CONCEPT | Not started | Phase 1 | **Yes** |
| **02** | Memory & Wisdom Vault | Foundation | CONFIRMED CONCEPT | Not started | Phase 1 | **Yes** |
| **03** | AI Conscience Engine | AI | CONFIRMED CONCEPT | Not started | Phase 2 | **Yes** (Tier 1 + constrained Tier 2) |
| **04** | Interaction Simulator | Interaction | CONFIRMED CONCEPT | Not started | Phase 2 | **Yes** (author rehearsal + adult recipients) |
| **05** | Guided Prompt Library | Capture | CONFIRMED CONCEPT | Not started | Phase 1 | **Yes** (editorial prompts only) |
| **06** | Dashboard, Permissions & Safeguards | Governance | CONFIRMED CONCEPT | Not started | Phases 1–2 | **Yes** |
| **07** | Feedback Loop | Child engagement + parent prompting | CONFIRMED CONCEPT | Not started | Phase 4 | No (G7) |
| **08** | Memory Canvas | Creative: emotional imagery | CONFIRMED CONCEPT; name PROVISIONAL | Not started | Phase 3 | No |
| **08A** | Playful Identity Image Generator | Memory Canvas submodule | CONFIRMED CONCEPT; name PROVISIONAL | Not started | Phase 3 | No |
| **09** | Video Canvas / The Echo Edit | Creative: audio/video | CONFIRMED CONCEPT; name UNRESOLVED | Not started | Phase 5 | No (G6) |
| **10** | Timed & Milestone Messages | Legacy delivery | CONFIRMED CONCEPT; triggers PROPOSED | Not started | Phase 3 | No (G3) |

**Historical evidence for modules 07–09 (HG-1):** the original checklist of 23 Jun 2025 (S-17) names **Feedback Loop, Memory Canvas and "Echo Edit"**, and planned to pick **one of them for the first release** (DR-049, C-33). The current S-09 MVP focus is 01–06. Whether one differentiating module should join MVP-1 is open (OQ-56). Modules 01–06: HG-1 (S-01/S-02). Module 08A and the detail of 07–10: HG-4 (S-05), confirmed as catalogue members by S-09 (HG-2). Module 10: S-02 "event-triggered messages" (HG-1).

**Implementation evidence:** none. No code, schema, prototype or deployment exists for any module (S-04 §4.1; S-05 §3.7; S-06 §3.7).

### Proposed roadmap phases (reconciled from S-05 §5.3 and S-06 §5.5)

| Phase | Name | Modules | Rationale |
|---|---|---|---|
| 0 | Reconcile & discover | — | This consolidation, then discovery interviews (RW-02) |
| 1 | Foundation | 01, 02, 05, 06 | Establish authenticity, consent and trust |
| 2 | Conversational MVP | 03, 04 (+06 extensions) | Test the core differentiated proposition |
| — | **MVP-1 = Phases 1 + 2**, then adult pilot | | |
| 3 | Release & creative expression | 10, 08, 08A | Milestone delivery; expression with lower child-profiling risk |
| 4 | Researched personalisation | 07 | Needs child-development and safety design |
| 5 | Advanced media | 09, synthetic voice | Highest rights, compute and impersonation complexity |

## 2. Module cards

### Module 01 — Parent & Family Profiles
- **Aliases:** Onboarding & Profile (S-01, S-04, S-06); Parent onboarding & family profile setup (S-02); Parent onboarding and profiles (S-05 MVP-01).
- **Purpose:** Identity, legacy profile, family relationship map, recipient records, consent capture and preferences.
- **Capabilities (all sources merged):** secure registration and verification (S-01, S-04); biography and context (S-06); relationship map with multiple children, guardians and separated families (S-04 §4.6, S-06 §4.2); recipient profiles, including minors as records without accounts (S-06 `beneficiaries`); trusted contact designation (S-04 `TrustedContact`); purpose-specific consent at onboarding (S-04 §4.4, S-06 §4.5); communication-style preferences (S-06 §4.8); progressive onboarding rather than one exhaustive interview (S-06 §4.5).
- **MVP-1 scope (PROPOSED):** author account + MFA; family map; recipient records; adult recipient invitations; trusted contact (record only); consent records (versioned).
- **Depends on:** — · **Feeds:** 02, 04, 06, 10.
- **Key safeguards:** creating a recipient never auto-grants access (S-04 §4.4); identity verification at invite and release transitions (S-04 §4.3).

### Module 02 — Memory & Wisdom Vault
- **Aliases:** Memory Vault (S-02); Core journal (S-01).
- **Purpose:** The canonical, model-independent store of the author's original material and approved derivations.
- **Capabilities:** text entries; audio recording with original preserved (S-04, S-06 §4.6); photos and video as attachments (S-02, S-04: video optional/later); transcription with timestamped segments and author correction (S-05 §4.3); AI-suggested tags, people, events and summaries, unapproved until reviewed (S-04 §4.4, S-06 §4.6); distinct **memory** vs **wisdom/value** objects (S-04 `ValuePrinciple`, S-06 `wisdom_entries`); per-item visibility, intended recipients, intended life stage and sensitivity (S-04 `MemoryEntry`); versioning and dated revisions (S-06 §4.2); export (S-04 §4.4).
- **MVP-1 scope (PROPOSED):** text + audio + optional still images; transcription + correction; memory and value statements; per-recipient visibility; versions; export. **Video deferred** (DR-027).
- **Depends on:** 01 · **Feeds:** 03, 05, 08, 09, 10.
- **Key safeguards:** never replace an original with its transcript; derived indexes must be invalidated and rebuilt on edit or deletion (S-06 §4.6); upload malware scanning (S-04 §4.3).

### Module 03 — AI Conscience Engine
- **Aliases:** "Lightweight GPT-powered engine trained on parent data" (S-01); "trained chatbot" (S-02).
- **Purpose:** Policy-governed retrieval and grounded response composition over **approved** author material.
- **Capabilities:** access filtering before retrieval (S-04 §4.3, S-05 §4.4); ranking by directness, context, provenance, completeness and consistency (S-05 §4.4); conflict/gap detection (S-05); evidence classification and labelling (R6 C-29 → 01B §4.3); citations to source memories; abstention with adjacent-memory suggestions (S-04 §4.5); style guidance from author-reviewed communication profile (S-06 §4.8); safety and crisis policy outside the model (S-04 §4.5); provider portability (S-06 §4.1).
- **Historical "train" language:** retained as UX wording; technical method PROPOSED as RAG-first (DR-022).
- **MVP-1 scope (PROPOSED):** Tier 1 + constrained Tier 2 (DR-024); E1/E2/E3 classes; citations; abstention; evaluation harness.
- **Depends on:** 02, 06 · **Feeds:** 04, 07 (later).
- **Key safeguards:** no fabricated memories; no unsupported opinions; AI identity disclosed; no cross-family retrieval.

### Module 04 — Interaction Simulator
- **Aliases:** Child Interaction Simulator (S-05); Child interface for Q&A (S-02); "Chat interface for child to 'talk' to parent's conscience" (S-01).
- **Purpose:** The conversational surface. **(a) Author rehearsal:** the author tests likely future questions, sees supporting evidence and gaps, and pins, corrects or suppresses answers (S-04 §2.2 item 4, §4.4 step 6; S-02 "manual override"). **(b) Recipient Q&A:** authorised recipients ask questions and receive labelled, cited answers (S-04 §4.5; S-06 §4.7).
- **Capabilities:** evidence badges; source cards linking to original memories and recordings; "original words first" (S-04 §4.5); pause, report an answer, hide topics (S-04 §4.5); a clear statement that it is an AI representation, including when asked "are you my parent?" (S-06 §4.13).
- **MVP-1 scope (PROPOSED):** author rehearsal (primary); adult-recipient Q&A in pilot under author consent; text interface; original audio playback.
- **Excluded from MVP:** minors; posthumous access; synthetic voice; avatars/video.
- **Depends on:** 01, 03, 06.

### Module 05 — Guided Prompt Library
- **Aliases:** Prompt Library & Suggestions (S-01); Prompt suggestion engine (S-02); Prompt Library (S-05/S-06).
- **Purpose:** Curated, guided questions to surface "gold nuggets" that parents might overlook.
- **Capabilities:** themes such as relationships, adversity, self-worth, mistakes, values, family traditions and future milestones (S-04 §2.2); prompts tagged by milestone and recommended recipient age (S-04 `PromptTemplate`); follow-up suggestions after capture (S-05 §4.3); gap invitations from rehearsal (S-04 §4.4); community-informed themes (S-01, S-02, S-06 D-009) **limited per DR-021**; adaptive branching (S-05 §2.6, shared with 07).
- **MVP-1 scope (PROPOSED):** editorial library (versioned); follow-ups; gap prompts from rehearsal. **No cross-family mining.**
- **Depends on:** 02 · **Feeds:** 02.

### Module 06 — Dashboard, Permissions & Safeguards
- **Aliases:** Admin & Safeguards (S-01, S-04, S-06); Parent controls & approval workflows (S-02); Parent Dashboard & Safeguards (S-05).
- **Purpose:** Author control centre plus platform governance.
- **Capabilities:** content management and approval workflows (S-02); per-item and per-recipient permissions; age-based access policy (S-01) enforced in the application (S-06 §4.9); consent records and withdrawal propagation (S-06 §4.12); audit log of access and generated answers (S-04 §2.2); **transparency logs** (S-02 original); deletion and export; release rehearsal (S-04 §4.4); report-and-review queue; administrator least privilege (S-06 §1.4).
- **MVP-1 scope (PROPOSED):** all of the above except live posthumous release and guardian/custodian powers.
- **Depends on:** 01 · **Governs:** all modules.

### Module 07 — Feedback Loop
- **Source:** detail from **S-05** (§2.6, §3.3, §4.5, §5.2; HG-4); preserved by S-09. **S-17 (original) confirms** the module existed by 23 Jun 2025, with a high-priority task to "define data flow for Feedback Loop: specify what inputs will be captured and how they influence responses" (HG-1). *"Influence responses" could mean parent-prompt suggestions (S-05) or AI answers; clarify when specifying.*
- **Concept (CONFIRMED CONCEPT, DR-013):** A child-facing, age-aware activity subset (scenarios, games, reflective questions) records the child's own answers. It produces **limited, non-diagnostic, low-confidence observations** about reasoning or perspective. These generate **parent-side reflection prompts and respectful counterpoints**, helping the parent articulate their values more fully. The parent answers, edits, rejects or branches; reviewed parent contributions are preserved in the Vault with traceability back to the child input.
- **Original 8-step sequence (S-05):** (1) child participates in an age-appropriate question or scenario → (2) response and context recorded → (3) limited observation of reasoning or perspective → (4) parent selects an opinion, belief, value or subject → (5) system offers follow-up questions or counterpoints informed by the child's response → (6) parent answers, clarifies, rejects or corrects → (7) questions may branch as a tree → (8) reviewed parent contributions become legacy content.
- **Worked example (S-05):** a fairness scenario ("I would ask both friends what happened") produces a low-confidence observation ("considered hearing both perspectives"), which leads to parent prompts: *What does fairness mean? How do you know when to compromise? What if your child's view differs? Which real experience shaped your belief? What do you want your child to remember as an adult?*
- **Mandatory protections (S-05, S-09):** explicit, revocable consent (guardian + age-appropriate child assent); no covert profiling; no clinical diagnosis or stable personality/mental-health labels; child-accessible correction and withdrawal; minimum retention; guardian permissions; protection against manipulation, harmful content, unsafe adult instructions; safeguarding for sensitive disclosures.
- **Unresolved trade-offs (S-05):** parent-guided vs direct child use; session-based vs longitudinal data; questionnaires vs open conversation; adaptive AI vs fixed decision trees; psychological tests vs non-clinical reflective games; posthumous uses; child review/correction/deletion rights → OQ-28 to OQ-34.
- **Adjacent research (historical, unverified):** LENA System; Thrive by Five (RW-03).
- **Disposition:** Phase 4; gate G7; detailed specification after RW-03.

### Module 08 — Memory Canvas
- **Source:** S-05 §2.7, §4.6; preserved by S-09. Name PROVISIONAL (DR-014); founder prefers the "Canvas" naming family.
- **Concept:** The parent describes a feeling, thought, memory, realisation or message about their child. Optional clarifying questions lead to an AI-generated image expressing the intended emotional meaning. The parent reviews it, adds an optional caption or voice note, and preserves it in the Vault with recipients and access rules.
- **Record keeping (S-05):** original parent text, emotional context, creative prompt, reference images, generated asset, timestamps, approval status, intended recipients, access policy, model and generation metadata.
- **Safeguards:** label every output as AI-generated creative work, never as historical photographic evidence; content moderation; consent for any person depicted.
- **Disposition:** Phase 3; OQ-35.

### Module 08A — Playful Identity Image Generator (Memory Canvas submodule)
- **Source:** S-05 §2.7.1; DR-015.
- **Concept:** Enjoyable themed pictures of the parent based on hobbies, interests or personality, to preserve humour, imagination and personality, not only serious advice. **Founder's example: images of himself as Superman.**
- **Implementation note:** reuses the Canvas record with `canvas_type = playful_identity`.
- **Unresolved (S-05):** likeness consent; reference-photo handling; character/IP rights (trademarked characters); creative moderation; labelling; cost → OQ-38, RK-11.
- **Disposition:** Phase 3.

### Module 09 — Video Canvas / The Echo Edit
- **Source:** S-05 §2.8, §4.7; preserved by S-09; **S-17 (original, 23 Jun 2025) names it "Echo Edit"**, name to be finalised, with creative references incl. "sample reels". **Naming history:** Personalized Echo → Echo Remix → The Echo Edit (HG-4, S-05) · "Echo Edit" in June 2025 (HG-1, S-17) · founder preference for a "Canvas" term (HG-4, S-05; reflected in S-09) → working label "Video Canvas / The Echo Edit" (not locked; OQ-40).
- **Concept:** The parent submits an eligible social-video URL (reference) or an upload. The service extracts spoken text and timing, attempts to identify background music, and lets the parent change the music and respond to timestamp-specific prompts derived from ideas in the original. The result is a **new, original** video featuring the parent's own message and, **if authorised**, their voice, image or footage.
- **Desired functions (S-05):** source link/upload; transcription; timestamp extraction; background-song detection; retained scene/narrative reference; alternative (licensed) music selection; timestamp-specific parent prompts; original script creation with parent approval; authorised synthetic narration; optional parental visuals; subtitles; render; review; preservation.
- **Mandatory conditions (S-05, S-09):** rights-cleared content only; a source link is **not** permission to copy; licensed music; original scripting; voice synthesis only from a verified, consented voice profile, with rules for posthumous use; rights record per asset.
- **Disposition:** Phase 5; gates G6 (voice) and legal review; OQ-39, OQ-40; RK-07, RK-11.

### Module 10 — Timed & Milestone Messages
- **Sources:** S-05 §3.4 ("proposed capability"), §4.8; **S-02 §5 "event-triggered messages" (original 2025 differentiator)**; S-04 `LegacyRelease`; S-06 §4.10 states; landing copy "Leave answers they'll need later — by age, by event…"; SafeBeyond pattern (historical); S-09 catalogue.
- **Concept:** The author prepares messages or content for release at a date, birthday, age, milestone (graduation, marriage, becoming a parent) or after verified death, to specific recipients.
- **Requirements to cover (S-05 §4.8):** event confirmation; errors; false death reports; revoked access; changing family relationships; premature release; indefinite restrictions; recipient refusal or deferral; account closure.
- **Disposition:** Phase 3. Date/age triggers to adult recipients first; posthumous triggers only after G3 and legal review; OQ-48.

## 3. Cross-module dependencies

```text
01 Profiles ──► 02 Vault ──► 03 Conscience Engine ──► 04 Interaction Simulator
     │              ▲  ▲            ▲
     │              │  └── 05 Prompt Library ◄── (gap prompts from 04)
     │              │
     │              ├── 08/08A Canvas (outputs stored in Vault)
     │              ├── 09 Video Canvas (outputs stored in Vault)
     │              └── 07 Feedback Loop (parent reflections stored in Vault)
     └──► 10 Timed & Milestone Messages (release of Vault items)
06 Dashboard, Permissions & Safeguards ── governs every arrow above
```
