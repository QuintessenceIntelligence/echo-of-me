# Echo of Me | 01B Consolidated Master Product Handoff

| Field | Value |
|---|---|
| Document ID | 01B |
| Version | v1.1 |
| Date | 16 November 2026 |
| Status | **CANONICAL master handoff.** Consolidates S-01 to S-17 as the working master. **All sources are retained unchanged and active; none is declared superseded without founder approval (DR-047).** |
| Evidence rule | Bracketed tags such as [S-05 §2.6] cite R1 sources. Historical claims carry **evidence grades** (R8 §2): HG-1 original · HG-2 founder-confirmed · HG-3 recovered fragment · HG-4 reconstructed · HG-5 inferred · +RV requires current validation. "NEW" marks recommendations made in this consolidation. All data models, flows and code are **PROPOSED designs**; **nothing has been implemented**. |
| Companion docs | 01A Charter · 01C Module Register · 01D MVP Boundary · R1–R7 registers |

---

## 1. Core Vision & Objective

### 1.1 Summary
Echo of Me is an AI-powered digital legacy platform by Quintessence Intelligence. Parents progressively capture their memories, values, reasoning, wisdom, voice and love. Authorised loved ones, primarily their children, can later consult that preserved material through a governed conversational interface that **distinguishes the parent's own words from AI interpretation and admits when something was never recorded**. Full vision, problem, principles and glossary: **01A**.

### 1.2 Project history
| Date | Event | Source | Grade |
|---|---|---|---|
| 29 May 2025 | Concept initiated: "copy of my conscience" for the founder's children | S-06 §3.1 | HG-4 (date reconstructed) |
| May–Jun 2025 | Exploratory research: legacy apps, AI interaction, competitors | S-06; S-01 §8 | HG-1 (research existed) |
| by 12 Jun 2025 | Name **Echo of Me** in use ("Hey Daddy" earlier working reference) | S-01/S-02 (Drive dates 12 Jun 2025); S-06; S-04 | HG-1 (name); HG-4 ("Hey Daddy") |
| 12 Jun 2025 | Scope & Brief and Full Dossier generated (`python-docx`, 20:12–20:16 UTC); Research Report v2 very probably in the same session; six MVP modules; tech shortlist; 12–14 weeks / US$20.5–30k | S-01; S-02; R8 K-05/K-06 | HG-1 (report timing HG-5) |
| Jun 2025 | Module expansion conversations: Feedback Loop, Memory Canvas, "Echo Edit" video module | S-05; **S-17** | HG-1 (existence); HG-4 (detail) |
| 23 Jun 2025 | **Master Checklist** created: finalise module names; **choose the first-release module from Feedback Loop, Memory Canvas or Echo Edit**; user journeys; creative references; Feedback Loop data flow; Notion-style board; visual pitch deck (deadlines 26 Jun–4 Jul 2025, now void) | **S-17** | HG-1 |
| Jun 2025 | Playful identity imagery ("Superman"); Canvas naming preference; SlidesGPT confidentiality question | S-05 | HG-4 |
| 2025 | Landing-page visuals generated; founder approved the look ("That is freakin perfect"); purple QI logo variant | S-04 §2.4; S-10; S-11 | HG-1 (images); HG-4 (quote) |
| 2025 | Creative brainstorm: holographic brain, orange/gold neural illumination, deep blue control room, person addressing a floating AI | S-06 §3.6 | HG-4 |
| 16 Nov 2026 | Migration to Claude: three reconstructed handoffs + reconstructed research report produced in ChatGPT (S-03 founder-confirmed regenerated) | S-03 to S-07 | HG-2 |
| 16 Nov 2026 | **This consolidation** (v1.0), then the recovery register and refresh plan (v1.1) | — | — |

### 1.3 Commercial intent
Echo of Me is both a deeply personal project and a potentially scalable commercial product. Investor readiness is a confirmed aim (DR-010) [S-05 §1.6]. Ownership, IP assignment and the investment vehicle are UNRESOLVED (OQ-50). S-03 and S-06 name the entity "Quintessence Intelligence (Pty) Ltd" (A-05, unverified).

### 1.4 Brand
Name, tagline and attribution are CONFIRMED (DR-001 to DR-003). Visual direction CONFIRMED as reference: cosmic navy, restrained teal glow, purple QI logo (DR-008). Candidate copy and the historical narrative: 01A §9.

---

## 2. Key Decisions & Trade-offs

### 2.1 Decision position (full detail: R2)
- **CONFIRMED:** name; tagline; QI attribution; parent-to-child primary use; conscience = governed representation, not consciousness; progressive capture; AI interaction; visual direction; full module catalogue 01–10/08A; modules 01–06 as MVP focus; six build documents; vertical-slice order; no build before boundary/sensitive-data/AI policy are defined; confidentiality rule for third-party tools.
- **CONFIRMED CONCEPT:** posthumous continuity; Feedback Loop; Memory Canvas; Playful Identity imagery; Video Canvas; Timed & Milestone Messages; community-informed prompts.
- **Awaiting founder approval (gates G1–G7):** capability tier; adult-only cohort and pilot; release model; AI method, answer taxonomy and data-use policy; web-first platform and budget; synthetic voice; child data.
- **HISTORICAL:** 2025 tech shortlist; 12–14 weeks / US$20.5–30k; GPT-4o for prototyping.

### 2.2 Module catalogue (full detail: 01C)
01 Parent & Family Profiles · 02 Memory & Wisdom Vault · 03 AI Conscience Engine · 04 Interaction Simulator · 05 Guided Prompt Library · 06 Dashboard, Permissions & Safeguards · **07 Feedback Loop · 08 Memory Canvas · 08A Playful Identity Image Generator · 09 Video Canvas / The Echo Edit · 10 Timed & Milestone Messages**.
> Recovery note: S-04 and S-06 omit 07–10 entirely. S-05 (detail, HG-4) and S-09 (catalogue, HG-2) are the authorities for them; the original checklist **S-17** (HG-1) proves 07, 08 and 09 existed by 23 Jun 2025, when one of them was to be chosen for the first release (C-33, OQ-56).

### 2.3 Fundamental trade-offs (merged from S-04 §2.3, S-06 §2.4, S-05 §2.6–2.8)
| Trade-off | Tension | Current recommendation |
|---|---|---|
| **Authenticity vs conversational flexibility** | Generative answers cover unforeseen questions but can invent beliefs | Hybrid: original words first; labelled, cited interpretation; abstain when unsupported (G4) |
| RAG vs fine-tuning | "Train the AI" was UX language; fine-tuning hurts editability, deletion, provenance and cost | RAG first; no fine-tuning in MVP (DR-022) |
| Authentic replay vs generated persona | Original audio/video is auditable; persona can mislead | Original recordings in MVP; synthetic voice under G6 |
| Web-first vs native | React Native "web + app" is not a web strategy | Responsive web MVP (G5) |
| Living preview vs posthumous/event release | Needs separation of drafts, approved shares and triggered release | Living preview in MVP; posthumous designed, not live (G3) |
| Age-gating vs real child safety | An age field does not establish maturity or legal authority | Adults-only MVP; guardian model later (G2) |
| Individual control vs aggregated insight | Cross-family signals risk leaking private content | Editorial prompts only; aggregate themes later with consent (DR-021) |
| Permanence vs deletion/cost | "Forever" conflicts with cost, erasure rights, insolvency | Export guarantees, preservation tier, honest copy (P-10) |
| Emotional realism vs dependency | Realism can deepen grief or dependency | Persistent AI disclosure; grief-informed design (P-06) |
| Static archive vs evolving persona | Evolution needs versioning and chronology | Versioned corpus; chronology preserved |
| Managed convenience vs portability | Lock-in threatens decades-long custody | Canonical, model-independent store (P-09) |
| Community contributions vs source purity | Others' recollections may be mistaken for the author's beliefs | Separately labelled contributor layer (DR-045) |
| Broad scope vs safety-tested MVP | 11 modules vs a small, testable core | 01D boundary |
| SaaS income vs decades of stewardship | Payment lapse after death | Preservation economics in doc 06 (A-17) |
| **Feedback Loop:** parent-guided vs direct child use; session vs longitudinal data; questionnaires vs open conversation; adaptive AI vs fixed trees; tests vs reflective games | Child profiling risk | Post-MVP; non-diagnostic; parent-initiated first (G7) |
| **Creative modules:** expression vs rights | Likeness, character IP, music licensing, platform ToS | Rights record per asset; licensed music; reference-only URLs |

### 2.4 Historical multimedia direction [S-06 §2.3]
Text capture/interaction: core · Voice recording: proposed input · Transcription: Whisper proposed · Spoken AI answers: ElevenLabs proposed · Video avatars: competitor research only · Live speech: not confirmed · Voice-cloning controls and synthetic-media labels: not defined. **Voice cloning is not approved** (G6).

### 2.5 Historical technology shortlist (all HISTORICAL; DR-034)
| Layer | 2025 options | Sources | Status |
|---|---|---|---|
| Client | React Native | S-01; S-02 | Historical; web-first recommended |
| API | Python FastAPI or Node.js | S-01 | Open |
| Data | PostgreSQL + Firebase; "embeddings" | S-01; S-07 | Open; vector store unspecified |
| Auth | Auth0 or Firebase Auth | S-01; S-02 | Open |
| LLM | OpenAI GPT-4 Turbo (S-01/S-02, HG-1) → GPT-4o "accepted for 2025 prototyping" (S-05 DEC-007, **HG-4 reconstruction-only**) | — | HISTORICAL; selection via ADR (DR-016) |
| Orchestration | LangChain | S-01 | Optional; evaluate |
| Transcription | Whisper | S-01; S-02 | Candidate |
| Voice synthesis | ElevenLabs "or similar" | S-01; S-02 | Candidate, gated by G6 |
| Hosting | Render / Vercel / AWS | S-01 | Open |
| Media storage, analytics, logging, payments | Not specified | S-06 §4.1 | Open |

### 2.6 Historical schedule and cost (DR-033, HISTORICAL)
**S-01 (original) six-phase plan, 14 weeks, with itemised cost:**

| Phase | Weeks | Cost line (USD) |
|---|---|---|
| 1 UX/UI design | 2 | Design & UX 2,500–4,000 |
| 2 Core development (app) | 4 | Frontend & backend 12,000–16,000 |
| 3 AI engine setup | 3 | AI/LLM integration 3,000–5,000 |
| 4 Audio & voice AI | 2 | Voice capture (optional) 2,000–3,000 |
| 5 Private pilot | 2 | — |
| 6 Launch prep | 1 | — |
| — | — | Hosting & security (6 months) 1,000–2,000 |
| **Total** | **14** | **20,500–30,000** (sums exactly; includes the "optional" voice line, so it is 18,500–27,000 without voice) |

**S-02 (original) five-phase plan, 12 weeks:** Design 2 · Development 4 · AI/Voice 3 · **Testing** 2 · Launch prep 1. Same total cost. Together these explain the "12–14 weeks" range (R6 C-04).

**Coverage gaps** [S-04 §2.5]: excludes regulatory advice, posthumous authorisation, production security assessment, incident response, long-term custody, accessibility, insurance, moderation, marketing and support. Pilot length conflicts (2 vs 6 weeks). **Re-estimate from first principles in doc 06.**

### 2.7 Confidentiality and third-party tools [S-05 §2.9]
The founder raised the risk of sharing Echo of Me IP with the SlidesGPT connector. Earlier assurances that connector use stays inside ChatGPT were too broad and must not be relied on. No vendor review was completed. **Rule DR-031:** no confidential material goes to third-party services without a provider-specific review (disclosure, processing, rights, retention, permissions) **and** founder approval.

---

## 3. Completed Work & Research

### 3.1 Competitive landscape (union of all sources; HISTORICAL, UNVERIFIED as of Nov 2026 — refresh under RW-01)
| Company / initiative | Historical description | Relevance / gap (historical view) | Sources | Grade |
|---|---|---|---|---|
| HereAfter AI | Audio-guided life interviews; recipients ask questions and hear recorded answers in the person's real voice | Strong authentic capture; limited to pre-recorded responses | S-02; S-04; S-06 | HG-1 +RV |
| StoryFile | AI-indexed recorded video answers to legacy questions | High realism; no generative capability | S-02; S-04 | HG-1 +RV |
| You, Only Virtual (YOV) | Generative "Versonas" built from emails, texts and voice data to emulate a person posthumously | **Judged "closest match" in 2025** (generative, interactive, voice-enabled) | S-01 §8; S-02 §3–4; S-04 | HG-1 +RV |
| Eternime | Digital alter ego from social/online data, growing over time | Strong conceptual match; "did not launch fully" | S-02; S-04 | HG-1 +RV |
| Replika | Adaptive AI companion | Generative but not legacy-based | S-02; S-04 | HG-1 +RV |
| Lifenaut | Mindfile-based avatars from uploaded data and questionnaires | Described as "nonprofit" and also "open source" (inconsistent, R6 C-21); limited execution | S-02; S-04 | HG-1 +RV |
| SafeBeyond | Non-AI time-capsule messages at future milestones | Excellent milestone model; static → informs Module 10 | S-02; S-04 | HG-1 +RV |
| StoryWorth | Recurring prompted stories leading to a book | Guided capture pattern; static | S-04; S-06 | HG-3 (report fragment) +RV |
| Living Wisely / LivingWisely | Values and legacy reflection prompts | Structured values capture; availability unverified | S-04; S-05; S-06 | HG-3 +RV |
| Eter9 | AI counterpart that continues social posting after death | Adjacent online-identity continuity | S-04 | HG-4 +RV |
| LifeChronicles / ethical wills | Guided recordings; values-oriented legacy records | Human-led precedent | S-04 | HG-4 +RV |
| Augmented Eternity (MIT) | Academic research on digital personas representing decision context and expertise | Modelling principles beyond autobiography | S-02 §10; S-04; S-05 | HG-1 (reference) +RV |
| Microsoft chatbot patent | Patent on person-specific conversational simulation | Prior-art discussion, not a market product | S-04; S-05 | HG-1 (Microsoft cited) / HG-4 (patent) +RV |
| Terasem Movement | Cited as an "ethical/technical inspiration" | Background only | S-02 §10 | HG-1 (reference) +RV |

All rows **+RV**: 2025 descriptions are historical, not current facts; refresh under R9/RR-01. S-03's versions of these descriptions are graded in R8 §4. Historical citations (Reuters, ABC, company sites) were never exported (M-10). Do not repeat historical prices or trial status as fact.

### 3.2 Strategic insights and research hypotheses
**Insights** [S-04 §3.2]: the market is not empty; the wedge (parent-guided capture + context-aware retrieval + author control + recipient protection) is a hypothesis; realism does not equal usefulness or safety; longitudinal completion is the key unknown; community trend-mining was an original idea, best done with aggregate categories; ethics and law are product-defining.

**Research hypotheses** [S-06 §3.4], all unvalidated: (1) passive archives are insufficient; (2) prompted reflection improves capture; (3) conversation makes archives accessible; (4) values and reasoning are crucial; (5) the knowledge base must evolve; (6) emotional trust is central.

**Risk taxonomy** [S-03 §8, reconstruction]: fabricated memories; emotional dependence; voice/likeness consent; privacy and family disputes; changed beliefs; child safeguarding; long-term continuity; model/vendor reliance → all in R4.

### 3.3 Feedback Loop adjacent research [S-05 §3.3]
The founder asked for research on products that collect children's reasoning, mindset or emotional-development signals and relay insights. Previously mentioned: **LENA System** (child language environments) and **Thrive by Five** (early-childhood activities). These are adjacent, not implementations of the parent-prompting loop. **No verified methodology comparison exists** (RW-03).

### 3.4 Market framing (historical)
"Significant opportunity among digitally aware parents, especially those concerned with legacy, estate planning, or terminal care" [S-02 §2]. **No TAM/SAM/SOM, pricing, conversion or pilot revenue was ever calculated** [S-03 §9; S-04 §5.2].

### 3.5 Brand, landing page and marketing work [S-04 §2.4, §3.4; S-10; S-11]
- **Landing visuals:** two static PNG mockups (not code, not clickable). Sections: hero, What is Echo of Me, What You Can Do (4 pillars), Who It's For, Ethics & Privacy (visual 1) / Join the Waitlist (visual 2). Full transcription, claims to fix and text artefacts: **R6 §5**.
- **Marketing plan (DRAFT, nothing launched):** segments = parents 28–50, estate-planning families, terminally ill parents, expatriate/military families, professional referral partners (hypotheses). Pre-launch landing page + waitlist + explainer; LinkedIn/social teasers. Content: stories of unsaid advice; founder narrative draft title *"Why I Built an AI to Raise My Kids When I'm Gone"* (**needs safeguarding review**: it conflicts with P-01). Partnerships: estate planners, family-support organisations, grief counsellors/therapists, parent creators (no implied clinical endorsement). Community: **"Legacy Circle"** newsletter. Press: ethical AI and meaningful preservation, not "resurrection". Assets specified but not drafted: 90-second explainer, social quote cards, waitlist email, shareable invitation.
- **Still outstanding:** functioning website, waitlist and consent copy; investor one-pager; 10–12-slide pitch deck; clickable prototype; full cost model; trademark and domain checks [S-04 §5.6].

### 3.6 Historical pilot plan and metric critique [S-04 §3.5, §5.5]
Six-week flow: wk 1 onboarding and consent → wk 2–3 capture 3–5 stories → wk 3–4 prototype Q&A → wk 5 feedback and emotional-impact survey → wk 6 debrief. Historical metrics and critiques: session time >15 min (rewards time-on-app); 80% completion of the first five prompts; 75% "emotional accuracy" (undefined); 8/10 perceived value (ignores grief risk); qualitative feature requests. **Replaced by H1–H8 in 01D §5.** The cohort originally included terminally ill and grieving participants; the recommendation is adults first, with vulnerable groups only under an ethics-reviewed protocol.

### 3.7 Artifact history and status ledger (merged S-04 §3.6, S-05 §3.5–3.7, S-06 §3.7)
| Artifact / area | Status |
|---|---|
| Vision, audience, name, tagline | Established |
| Six MVP modules + modules 07–10 | Concepts captured; **no implementation** |
| Tech options; cost/schedule | Historical proposals |
| Research Report v1 & v2 (original) | **Missing** (M-01, M-02); reconstruction only (S-03) |
| Scope & Brief; Full Dossier | Present (S-01, S-02) |
| Project Documents ZIP; Master Project File; Rebuilt master | Missing (M-03 to M-05) |
| `Echo_of_Me_Master_Checklist.xlsx` | **Recovered 16 Nov 2026 from Google Drive → S-17** (original, 23 Jun 2025; 7 tasks; board stages backlog / in progress / ready / done). Earlier visual tables did not render on the founder's device |
| Notion board | Never verified as created (M-07) |
| Pitch deck | Scoped (problem, vision, personas, Feedback Loop, Memory Canvas, video module, mockups, architecture, roadmap, investor positioning); delivery not verified (M-08) |
| Landing visuals; QI logos | Present (S-10 to S-16) |
| PRD, ERD, API spec, schema, code, prototype, deployment, legal/privacy review, AI evaluation, user interviews, validated business model | **Not started / not verified** |

---

## 4. Data Models & Logic (PROPOSED design; nothing implemented)

### 4.1 Logical architecture (merged S-04 §4.3, S-05 §4.1, S-06 §4.1)
```text
Author experience · Recipient experience · Guardian/Custodian experience (later)
   onboarding · capture & review · rehearsal · grounded Q&A · Feedback Loop* · Canvas* · Video Canvas*
                               │
              Authenticated Backend API (policy enforcement point)
   identity & roles · relationships & guardianship · consent · per-item access policy
   release scheduling & verification · rate limits · audit
                               │
   ┌───────────────────────────┼──────────────────────────────┐
 Canonical Vault        Memory & Conscience Intelligence     Media Services
 originals · approved   ingest · transcribe · enrich ·        audio · images · (video*)
 text · values ·        author validation · policy-filtered   transcription · (synthetic
 versions · provenance  retrieval · evidence classification   audio* under G6)
                        grounded generation · validation ·
                        safety · evaluation
   └───────────────────────────┼──────────────────────────────┘
                               │
 Persistence: relational records · encrypted object storage (originals) · search/vector
 index (DERIVED, rebuildable) · audit log & consent history · backups/export
(* post-MVP)
```
Rules: originals and approved text are canonical; embeddings and summaries are regenerable derived assets [S-06]; access filtering happens **before** retrieval [S-04; S-05]; policy lives outside the model [S-04 §4.6].

### 4.2 Unified logical entity catalogue
Merges S-04 §4.2, S-05 §4.2/§4.5–4.7 and S-06 §4.2. Names are logical; the physical schema is decided in doc 03.

| Canonical entity | Purpose / key fields | Historical names |
|---|---|---|
| `user` | Authenticated person: id, email, auth_subject, locale, status | User/Author (S-04), User (S-05), users (S-06) |
| `legacy` | One author's legacy: owner, title, bio, **state** (§4.10), version, style preferences | LegacyPersona, legacy_profiles, ParentProfile |
| `family` / `relationship` | Family group and typed relationships (parent, child, guardian, custodian, contributor) with legal/access context | Family, FamilyRelationship, relationships |
| `recipient` | Intended recipient (may lack an account, e.g. a minor): relationship, birth date (optional), guardian_id, identity-verification status, invited_at | Recipient, ChildProfile, beneficiaries |
| `trusted_contact` | Nominated helper for release verification; identity-proofing status; **no unilateral override** | TrustedContact (S-04) |
| `memory` | First-person entry: kind, title, body, occurred_at, sensitivity, visibility, intended life stage, provenance class, approval state, version | MemoryEntry, Memory, memory_entries |
| `value_statement` | Belief or principle + reasoning + contexts + supporting memory links + last reviewed | ValuePrinciple, ValueStatement, wisdom_entries |
| `media_asset` | Original file: type, storage key, owner, permitted uses, consent status | MediaAsset, media_assets |
| `transcript` / `transcript_segment` | Speaker, timestamps, corrections, approval | Transcript |
| `prompt_template` / `prompt_response` | Theme, milestone, recommended age, text, source [editorial / aggregate], version; answers over time | PromptTemplate, PromptResponse, prompts |
| `access_policy` / `access_grant` | Recipient × item/topic rules, release trigger, guardian constraints, validity | AccessPolicy, access_grants |
| `release` | Trigger (date / age / milestone / death_verified), verification status, authorised_by, executed_at, audit reason | LegacyRelease, MilestoneRelease, legacy_activation_events |
| `conversation` / `message` | Session context; question; answer; **evidence_class**; source references; policy decision; abstention | Conversation, InteractionSession, Message/Answer, messages |
| `source_reference` | Answer → memory/segment span | source_references |
| `pinned_answer` (NEW) | Author-approved rehearsal answer (DR-030) | — |
| `consent_record` | Person, purpose/scope (voice, AI, cross-user insight, share, child activity), text version, granted/revoked | ConsentRecord, ConsentGrant, consent_records |
| `audit_event` | Actor, action, target, time, context, outcome; minimised payload | AuditEvent, audit_events |
| Feedback Loop (Module 07) | `child_activity`, `child_activity_session`, `child_response`, `observed_reasoning`, `parent_reflection_prompt`, `prompt_branch`, `parent_reflection`, `reflection_link` | S-05 §4.5 |
| Canvas (08/08A) | `canvas_creation` (canvas_type: emotional / playful_identity) | S-05 §4.6 |
| Video Canvas (09) | `video_project`, `source_reference_media`, `transcript_segment`, `audio_identification`, `script_draft`, `parent_script_approval`, `voice_profile`, `music_selection`, `scene_asset`, `rendered_video`, `rights_record` | S-05 §4.7 |

Candidate relationships [S-06 §4.2]: one user may own several legacies; one legacy has many recipients; one recipient may access several legacies; memories relate many-to-many with people and values; prompts may have many answers over time; answers cite many sources; item-level grants override profile defaults; revisions never overwrite history.

**Illustrative record (fictional, not a schema)** [S-06 §4.3–4.4]:
```json
{ "id": "memory_001", "legacy_id": "legacy_001", "entry_type": "life_lesson",
  "title": "Learning from failure", "topics": ["resilience","career"],
  "intended_recipients": ["recipient_001"], "provenance_class": "P2_author_written",
  "approval_state": "author_confirmed", "visibility": "restricted", "version": 1 }
```

### 4.3 Provenance and evidence taxonomy (NEW unification; PROPOSED for G4)
Reconciles S-04 `generation_mode`, the S-05 evidence classes, the S-06 response classes and S-08's list of distinctions.

**Source provenance (what the material is):**
| Class | Definition | Citable as author's view? |
|---|---|---|
| P1 Original recording | Author's own audio/video, unaltered | Yes |
| P2 Author-written | Text written directly by the author | Yes |
| P3 Approved transcript | Machine transcript corrected/approved by the author | Yes |
| P4 Approved derivation | AI-suggested summary/value statement, explicitly approved by the author | Yes, labelled "summary approved by [author] on [date]" |
| P5 Contributor-authored | A family member's recollection | No: shown as "[contributor] remembers…" |
| P6 Unapproved AI derivation | Tags, suggestions, unreviewed transcripts | **Never** cited or attributed |

**Answer evidence (how well a reply is supported):**
| Class | Rule | Presentation | Historical equivalents |
|---|---|---|---|
| **E1 Direct** | A P1–P4 source directly addresses the question, or an author-pinned answer | Quote or playback first; "In their own words"; citation | quoted; DIRECTLY SUPPORTED; directly documented |
| **E2 Grounded interpretation** | Related approved sources support an interpretation; no direct answer | "Based on what they recorded…"; limits stated; citations | retrieved/synthesized; PARTIALLY SUPPORTED; contextually inferred |
| **E3 Not recorded** | No sufficient approved source | "I don't have anything they recorded about that." + adjacent memories; **no attributed belief** | unknown; UNSUPPORTED |
| Policy outcomes | Restricted (not shared with you) · Safety redirect (crisis) | No content leakage; human-help resources | policy_decision (S-04) |

### 4.4 Author journey (merged S-04 §4.4, S-06 §4.5)
1. Register and verify; accept clear, purpose-specific consents (living use, sharing, AI processing, later posthumous terms).
2. Create the legacy; add context and family relationships.
3. Add recipients and a trusted contact. **Nothing is auto-shared.**
4. Capture: answer guided prompts or add spontaneous text and audio (photos optional; video later).
5. AI transcribes, tags and suggests summaries; the author sees source vs inference and corrects it.
6. Approve memories, value statements, optional style profile and recipient-specific availability.
7. **Rehearse:** e.g. "What would I tell my child when they fail an exam?" See evidence, gaps and invitations to record more; pin, correct or suppress answers.
8. Manage: edit, delete, withdraw consent, export, review who can access what, rehearse release behaviour.
9. Keep enriching over years (progressive, not one exhaustive interview).
10. Set succession, release and deletion preferences (live only after G3).

### 4.5 Ingestion workflow [S-04 §4.3; S-05 §4.3; S-06 §4.6]
```text
Author input (text / audio / image)
 → authenticate + associate legacy → malware scan
 → preserve ORIGINAL (P1/P2) with metadata and ownership
 → transcribe if needed (timestamped)                    [P6 until approved]
 → suggest topics, people, values, follow-up prompts     [P6]
 → author corrects and approves                          [→ P3/P4]
 → set visibility, recipients, sensitivity, release rule
 → version the approved content
 → build derived index entries linked to source spans (rebuildable)
 → eligible for policy-governed retrieval
```
Never replace an original with its transcript. Treat automated extraction as unverified. Keep third-party information permissioned. Corrections are auditable and invalidate derived indexes.

### 4.6 Recipient (and rehearsal) question-answering workflow [S-04 §4.5; S-05 §4.4; S-06 §4.7]
```text
Question
 → verify identity, relationship and session
 → resolve permitted corpus (legacy state, release rules, per-item grants, age/guardian policy, sensitivity)
 → crisis / high-risk screen (outside the model)   → Safety redirect if triggered
 → retrieve ONLY permitted, approved (P1–P5) material
 → rank: directness, context, provenance, completeness, consistency, recency
 → detect conflicts, gaps and changed views
 → classify E1 / E2 / E3
 → E3: transparent "not recorded" + adjacent memories
 → E1/E2: compose grounded answer; original words first; cite sources
 → validate: every attributed claim maps to a cited source; labels present; policy re-checked
 → deliver (text; original-audio playback where available)
 → audit with source IDs under retention rules
```
**Illustrative pseudocode (S-06 §4.7; not project code):** `permissions = get_access_permissions(...)` → refuse if not permitted → `retrieve_approved_sources(permissions)` → `apply_content_policy` → `classify_evidence` → if unsupported, return "I don't have enough of your parent's recorded thoughts to answer that faithfully." with no sources → otherwise `generate_grounded_answer` → `validate_response`.

### 4.7 Communication-style profile [S-06 §4.8]
Example fields: warmth, humour, directness, preferred language; persona_status = creator_reviewed; persona_version. **Keep three concepts separate:** (a) the author's historical speaking style as evidenced in sources; (b) the author's explicit preferences for how the AI should present; (c) each recipient's presentation preferences. Never infer unsupported personality traits for engagement.

### 4.8 Feedback Loop data and flow (Module 07; S-05 §4.5)
```text
Child engages in an age-appropriate situation (guardian-initiated)
 → response saved with consent, context and age band
 → limited, non-diagnostic, low-confidence observation generated
 → parent receives a suggested question and/or respectful counterpoint
 → parent elaborates, rejects, edits or branches
 → reviewed parent contribution preserved in the Vault (P2/P4)
 → reflection_link keeps child input → prompt → parent response traceable
```
Illustrative record (S-05; not a schema): `activity_type: hypothetical_scenario`, `age_band: 8-10`, response "I would ask both friends what happened.", observation {"The child considered hearing both perspectives.", confidence low, basis "Single scenario response", clinical_interpretation false}, suggested parent prompt "How would you explain fairness when two people disagree?", status pending_parent_review.

### 4.9 Memory Canvas and Video Canvas flows
- **Memory Canvas (08/08A)** [S-05 §4.6]: parent reflection → optional clarifying questions → visual prompt → image generation → parent review → optional caption or voice note → Vault → recipients and access rules. Fields: canvas_id, creator_id, family_id, canvas_type, original_parent_text, emotion_context, creative_prompt, reference_asset_ids, generated_asset_id, recipient_ids, creation_timestamp, approval_status, access_policy_id, model_and_generation_metadata. Outputs are labelled creative, never historical evidence.
- **Video Canvas (09)** [S-05 §4.7]: (1) import user-owned/licensed material or a permitted reference URL → (2) extract speech with time alignment → (3) analyse narrative ideas and structure → (4) identify music where possible and verify rights separately → (5) prompt the parent at relevant timestamps → (6) create an original script with parent approval → (7) choose licensed music and authorised images/footage → (8) synthetic narration only from a verified, consented voice profile → (9) render captions, narration, music, visuals → (10) parent reviews, approves, assigns recipients, saves.

### 4.10 Legacy lifecycle and release states (merged S-04 persona states + S-06 §4.10; PROPOSED)
| State | Meaning | Author can edit? |
|---|---|---|
| Draft | Setting up, first captures | Yes |
| Active | Ongoing capture, rehearsal, living shares | Yes |
| Prepared | Succession, release and custodian instructions defined | Yes |
| Activation pending | A release event (e.g. death) has been reported | Locked pending verification |
| Verification required | Evidence and appointed-authority checks under way | Locked |
| Legacy active (**Frozen**) | Eligible recipients may access per rules; author corpus frozen; contributor layer separate | No |
| Suspended | Dispute, security concern or false report | No |
| Archived / Deleted | Retention or deletion policy applied | — |

Edge cases to design for [S-05 §4.8; S-06 §4.10]: false death notice; incapacity; separation/divorce; changing custodians; family conflict; recipient death; recipient turning 18; withdrawal; heirs disputing access; third-party privacy; payment ending; service closure; recipient refusal or deferral; indefinite restrictions.

### 4.11 Community prompts and contributions [S-06 §4.11; S-01; S-02]
```text
Editorial themes + (later) voluntary, consented, de-identified question themes
 → editorial quality and privacy review → categorised Prompt Library
 → author answers in their own words → approved personal knowledge base
```
A community *question pattern* is never consent to use anyone's personal answers. Contributor recollections are P5 and never become "what the author believed".

### 4.12 Security and privacy control checklist (PROPOSED; validated in doc 05)
Identity verification, MFA and recovery with proofing · role + item-level permissions (author, recipient, guardian, custodian, contributor, admin) · encryption in transit and at rest; encrypted object storage for originals; key rotation · per-legacy isolation; access filtering before retrieval · secrets management; restricted, audited admin access (break-glass) · consent records and withdrawal propagation to indexes and synthetic assets · prompt-injection defences; output validation · retention, export, portability and secure deletion · backups and tested restore · regional residency and cross-border transfer review · threat model: account takeover, voice deepfakes, coercive access, cross-family leakage, prompt injection, insider access [S-04 §5.3] · legal review: POPIA (special personal information, children), consumer protection, voice/likeness rights, third-party rights, digital-estate authority ⚖.

### 4.13 Edge cases and mandatory tests (union of S-04 §4.6 and S-06 §4.13)
| Situation | Required behaviour |
|---|---|
| No source for a question | E3; never invent |
| Author changed views over time | Preserve chronology; disclose earlier and later views |
| Sources contradict | Flag the conflict; do not silently resolve |
| Author's recorded claim is factually wrong | Distinguish personal recollection from verified external fact |
| Private note for one child | Enforce per-recipient access |
| Sensitive third-party content (ex-partners, medical secrets, defamatory statements) | Restrict; flag; default-private |
| Generated advice contrary to source values | Suppress unsupported attribution |
| Sarcasm, jokes, metaphors in sources | Avoid literal misreading; prefer quoting |
| Inaccurate transcript | Correction flow; original audio available |
| Cross-language questions | Governed translation and attribution (post-MVP) |
| "Are you my parent?" | Clear AI disclosure |
| Distressed recipient; crisis, self-harm, abuse | Safety redirect to human/professional help |
| Requests for predictions ("What would Dad think of this new person?") or political/medical/financial decisions beyond evidence | Careful attribution or E3; no fabrication |
| Upload of third-party data or another person's voice | Separate rights and permissions required |
| Prompt injection in documents or questions | Policy outside model; content treated as data |
| Author revokes consent | Propagate to sources, indexes and outputs as required |
| Revocation after a recipient made copies | Policy and transparency on limits |
| Author dies before completing setup / no verified executor | Prevent premature release and takeover |
| Recipient is a minor, in another jurisdiction, or reaches a milestone during a dispute | Guardian rules; legal review; suspension |
| Multiple children, separated families, guardianship disputes, exclusion of a recipient, death of a trusted contact | Item-level access; dispute workflow; re-nomination |
| Model/voice vendor exits; insolvency; payment lapse; platform closure | Canonical store; export; continuity plan |
| Family contests access | Human review and dispute controls |

### 4.14 AI evaluation framework [S-06 §5.6; S-04 §5.5]
Retrieval relevance · groundedness · attribution accuracy · hallucination resistance (abstention precision) · authorisation enforcement · age suitability (enforced outside the model) · provenance traceability · consistency across related questions · persona fidelity (style from real material only) · usability and emotional safety (users understand limits) · data portability · blinded author review of answers, replacing vague "emotional accuracy". Proposed thresholds: 01D §5. Test suites: doc 04.

---

## 5. Open Questions & Next Steps

### 5.1 Top open questions (full list: R5)
P0: first core promise (OQ-05); living vs bereavement focus (OQ-06); target user and payor (OQ-07); minimum content (OQ-08); extrapolation limits and attribution threshold (OQ-09, OQ-10); citations (OQ-11); visible separation (OQ-45); conflicts (OQ-12); limited-evidence behaviour (OQ-14); minors (OQ-18); living vs posthumous access (OQ-19); voice (OQ-26); budget ceiling (OQ-41). Plus **recover the original research report** (OQ-01).

### 5.2 Prototype scenarios [S-05 §5.5]
1. **First capture:** a parent records a life lesson; the system follows up and stores approved evidence.
2. **Unanticipated question:** something never answered directly; related memories found; limits acknowledged.
3. **Feedback Loop** (post-MVP): fairness scenario → non-diagnostic parent prompts → parent records a perspective.
4. **Memory Canvas** (post-MVP): parent describes a feeling → creates and approves a visual memory with a caption.
5. **Video Canvas** (post-MVP): permitted reference → original script → approved narration and licensed assets.
Plus prototype comparisons [S-06 §5.4]: guided capture; archive search vs chat; values-grounded questions; original voice playback; AI-generated speech (later); citation and uncertainty UI.

### 5.3 Roadmap
Phases 0–5 in 01C §1. MVP-1 boundary, acceptance criteria and hypotheses in 01D.

### 5.4 Remaining deliverables mapped to canonical homes
| Deliverable (historical lists: S-04 §5.6, S-05 §5.6, S-06 §5.8) | Canonical home |
|---|---|
| Vision & Charter | **01A ✔** |
| Source & Decision Register; assumptions; open questions; conflicts | **R1–R6 ✔** |
| Original research recovery; research refresh plan | **R8, R9 ✔** |
| Refreshed research (competitors, AI tech, legal, market, architecture) | RR-01 to RR-05 (pending, R9) |
| Functional Module Register | **01C ✔** |
| PRD (personas, journeys, stories, acceptance, accessibility) | 02 (pending) |
| Architecture, ADRs, ERD, API contracts, data dictionary, access matrix | 03 (pending) |
| AI Conscience spec, retrieval/evidence policy, evaluation suite | 04 (pending) |
| Privacy, consent, child safeguarding, legacy activation, threat model | 05 (pending) |
| MVP delivery plan, costs, team, pilot protocol | 06 (pending) |
| Implementation & governance playbook | 07 (pending) |
| Feedback Loop, Memory Canvas, Video Canvas, Timed Messages specs | Module specs `M07`–`M10` (pending, post-MVP) |
| UX and prototype pack; competitor research; commercial and investor pack (one-pager, 10–12-slide deck, financial model); brand identity | Later workstreams |
| Notion board (DR-036) | After vendor approval (OQ-51); backlog lives in doc 06 meanwhile |

### 5.5 Business model options (research only; none approved) [S-06 §5.7; S-03 §9]
Subscription during active creation · one-time guided recording package · long-term preservation plan · family memberships · premium voice/media · assisted legacy sessions · institutional/partner channels. **Core challenge:** funding decades of access after the author stops paying or dies.

### 5.6 Operating instructions for Claude sessions (merged S-05 §5.7, S-06 §5.10, S-08, S-09)
1. Treat historical material as context, not proof of implementation.
2. Read 00 README, 01A and R2 first; cite R1 IDs for material claims.
3. Keep CONFIRMED decisions separate from proposals; never promote a recommendation without a logged approval.
4. Preserve all modules 01–10/08A; specify them, never drop them.
5. Never fabricate parental memories or present AI output as the parent.
6. Treat children's data, voices and bereavement interactions as highly sensitive.
7. Do not send confidential content to third-party services without review and approval (DR-031).
8. Record gaps explicitly rather than filling them with plausible detail.
9. For each substantial proposal state: source requirement, status, user need, constraints, options and trade-offs, recommendation, risks and edge cases, acceptance criteria, next tasks [S-06 §5.10].
10. Mark legal ⚖ and clinical 🩺 review needs; never claim compliance.
11. Do not code until G1–G4 are decided and docs 02/04/05 are approved (DR-041).

### 5.7 Recommended next executable task
1. **Founder decision session on gates G1–G7 and OQ-56** (R2 §3; whether one differentiating module joins MVP-1).
2. In parallel, Claude runs **RR-02 (AI technology) and RR-03 (legal orientation)** (R9), which are safe and reversible.
3. Then draft **doc 04 (AI Conscience & Memory Intelligence)** and **doc 05 (Security, Privacy & Legacy Governance)** together, then doc 02 (PRD).
4. Founder recovery action: open the June 2025 ChatGPT conversation and copy the research report's generation script (R8 §7.2). This is non-blocking (DR-048).
