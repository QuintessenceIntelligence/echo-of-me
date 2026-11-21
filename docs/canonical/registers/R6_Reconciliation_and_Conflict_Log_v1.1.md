# Echo of Me | R6 Reconciliation & Conflict Log

| Field | Value |
|---|---|
| Document ID | R6 |
| Version | v1.1 |
| Date | 16 November 2026 |
| Status | CANONICAL. Resolutions marked **RECOMMENDED** need founder approval where a decision gate applies. |
| Inputs | S-01 to S-17 (see R1); v1.1 adds S-17 and the S-03 claim grading (R8) |

## 1. Method

1. Every source was read in full: S-01 to S-09 as text, and S-10/S-11 visually.
2. Each source was broken into statements: vision, brand, decision, module, requirement, entity, workflow, estimate, research claim, risk, open question and artifact.
3. Statements were matched across sources to classify each as **duplicate** (same meaning), **overlap** (compatible, different detail), **conflict** (incompatible) or **unique** (appears in one source only).
4. Conflicts were resolved using the R1 authority ranking. Where the evidence cannot settle a conflict, it is logged with a recommended resolution and linked to R2/R5.
5. Unique statements were carried into the canonical documents (see R1 §4 for destinations).

## 2. Coverage matrix: where each topic appears

| Topic | S-01 | S-02 | S-03 | S-04 | S-05 | S-06 | S-07 | S-08/09 |
|---|---|---|---|---|---|---|---|---|
| Vision / "copy of conscience" | ● | ● | ● | ● | ● | ● | ○ | ● |
| Name + tagline | ● | ● | ○ | ● | ○ | ● | ● | ● |
| Six MVP modules (01–06) | ● | ● | ● | ● | ● | ● | ○ | ● |
| **Feedback Loop (07)** | – | – | – | **–** | ● | **–** | – | ● |
| **Memory Canvas (08/08A)** | – | – | – | **–** | ● | **–** | – | ● |
| **Video Canvas (09)** | – | – | – | **–** | ● | **–** | – | ● |
| **Timed & Milestone Messages (10)** | – | ○ "event-triggered" | ○ | ○ (release triggers) | ● | ○ (states) | – | ● |
| Tech shortlist | ● | ● | ● | ● | ● | ● | ● | – |
| Timeline / cost | ● | ● | ● | ● | ● | ● | ● | ○ |
| Competitors | ○ | ● | ● | ● | ● | ● | – | – |
| Logical data model | – | – | – | ● | ● | ● | – | – |
| Evidence/answer classes | – | – | ○ | ● | ● | ● | ○ | ● |
| Posthumous lifecycle | – | – | ○ | ● | ○ | ● | ○ | ○ |
| Pilot plan & metrics | ○ (2 wk) | ○ (testing) | – | ● | – | ○ | ● | ○ |
| Marketing / landing page | – | ○ | – | ● | – | – | ○ | ○ |
| Confidentiality (SlidesGPT) | – | – | – | – | ● | – | – | ○ |

● substantive · ○ brief mention · – absent

**Main finding:** **S-04 and S-06 both omit modules 07–10**, so a reader relying on either would lose four modules. S-05 is the only detailed source for them, and S-09 confirms that they must be kept. This was the most important recovery in the consolidation.

## 3. Duplicates and overlaps (no conflict)

| Theme | Sources | Treatment |
|---|---|---|
| Founding phrase "copy of my conscience" | all | Kept verbatim in 01A |
| Problem of "unasked questions" / "words left unsaid" | S-02, S-03, S-05, S-06 | Merged in 01A §3 |
| Historical tech shortlist (React Native, FastAPI/Node, PostgreSQL/Firebase, GPT, LangChain, Whisper, ElevenLabs, Auth0/Firebase Auth, Vercel/Render/AWS) | S-01 to S-06 | One table in 01B §2.5, marked HISTORICAL |
| Competitor set (HereAfter AI, StoryFile, YOV, Eternime, Replika, Lifenaut, SafeBeyond) | S-02 to S-06 | Union of all named entities (15 + 2 adjacent) in 01B §3.1 |
| Need to separate source evidence from AI inference | S-03 to S-09 | Unified taxonomy in 01B §4.3 (proposed, gate G4) |
| Policy enforced before retrieval / outside the model | S-04, S-05, S-06 | Principle P-07 in 01A |
| POPIA and jurisdiction review | S-04, S-05, S-06 | R4 RK-10; doc 05 later |
| Model and vendor portability | S-03, S-06 | Principle P-09 in 01A |
| Adult-first validation | S-04, S-06 | MVP boundary 01D |

## 4. Conflicts and resolutions

| ID | Conflict | Evidence | Resolution | Status |
|---|---|---|---|---|
| **C-01** | **Tagline exclusivity.** S-06 says no single tagline was established; S-04, S-07 and S-08 say the primary tagline is LOCKED. | S-01 lists four taglines with no priority; S-02 uses only "Because your love deserves a voice beyond time."; S-08 is founder governance. | Founder governance (rank 1) prevails: the primary tagline is **CONFIRMED**. The other lines are approved candidate *secondary* copy only. | Resolved |
| **C-02** | **Foundation model.** S-01/S-02 name GPT-4 Turbo; S-05 says GPT-4o was "HISTORICAL CONFIRMED" in June 2025; S-04 says no model was ever approved. | S-05 is the only claim of acceptance, and it is a reconstruction. | Record GPT-4o as **HISTORICAL** (accepted for 2025 prototyping, per S-05). There is **no current model commitment**. Selection goes through an ADR with provider-portability criteria (doc 03). | Resolved (historical); model choice remains UNRESOLVED (DR-016) |
| **C-03** | **"Train" / fine-tuning vs retrieval.** S-01 says "trained on parent data"; S-02 says "trained chatbot" and "longitudinal parent-AI training"; S-04/S-06 propose RAG first. | No source records an approved ML method. S-04 states that "train" described user experience. | "Train / teach your Echo" is kept as **product language**. The technical method is **PROPOSED: source-grounded retrieval first, no fine-tuning in MVP**, to be confirmed at gate G4. | Recommended |
| **C-04** | **Timeline 12 vs 14 weeks.** | S-01: 2+4+3+2+2+1 = **14** (includes a 2-week private pilot and 2 weeks of voice). S-02: 2+4+3+2+1 = **12** (AI and voice merged into 3 weeks; 2 weeks of "testing" with no pilot). | The "12–14 weeks" range simply spans the two originals. Both are **HISTORICAL** and must be re-estimated from first principles (doc 06). | Resolved (explained) |
| **C-05** | **Pilot duration 2 vs 6 weeks.** | S-01 Phase 5 = 2 weeks; S-04 §3.5 proposes a 6-week validation flow; S-02 has no pilot. | The 6-week adult pilot (S-04) is **PROPOSED** as a separate gate *after* the MVP build, not part of build weeks. | Recommended (DR-025) |
| **C-06** | **MVP media scope.** | S-01: text + voice. S-02: text/audio/**video**. S-04: text + audio, video optional/later. Landing copy: "Write or speak". | **Recommended:** MVP = text + audio (original audio preserved) + optional still-image attachments. Video capture is deferred. | Gate G5 (DR-027) |
| **C-07** | **Module 04 name and scope.** | "Interaction Simulator" (S-01, S-04, S-06, S-09); "Child Interaction Simulator" (S-05); "Child interface for Q&A" (S-02). S-04 adds author-side rehearsal. | Canonical name **Interaction Simulator** (S-09). Scope covers **author preview/rehearsal and recipient Q&A**. "Child" was dropped because the MVP recipient cohort is adult (G2). | Resolved (name); scope recommended |
| **C-08** | **Module 05 name.** | "Prompt Library & Suggestions" (S-01), "Prompt suggestion engine" (S-02), "Prompt Library" (S-05/S-06). | Canonical: **Guided Prompt Library** (S-09). | Resolved |
| **C-09** | **Module 06 name.** | "Admin & Safeguards" (S-01/S-04/S-06), "Parent controls & approval workflows" (S-02), "Parent Dashboard & Safeguards" (S-05 table), "Dashboard, Permissions & Safeguards" (S-05 register). | Canonical: **Dashboard, Permissions & Safeguards** (S-09). | Resolved |
| **C-10** | **Module 01 name.** | "Onboarding & Profile" (S-01/S-06), "Parent onboarding & family profile setup" (S-02), "Parent & Family Profiles" (S-05). | Canonical: **Parent & Family Profiles** (S-09). | Resolved |
| **C-11** | **Status of module 10.** | S-05: "Proposed capability"; S-02 (original): "event-triggered messages" as a differentiator; landing copy: "Leave answers they'll need later — by age, by event". | Catalogue membership is **CONFIRMED** by S-09. Concept = **CONFIRMED CONCEPT**. Behaviour and triggers = PROPOSED. Not in MVP. | Resolved |
| **C-12** | **Community insights vs privacy promise.** | S-01 goal: "leverage collective insights across families"; S-01 module: "community-sourced wisdom and trending parent topics"; landing S-10: "We don't use your data to train anyone else's AI". | Compatible only if community input is limited to **editorially reviewed, opt-in, aggregate question themes**, never personal answers or cross-family model input. MVP uses **editorial prompts only**. | Recommended (DR-021) |
| **C-13** | **Voice.** | S-01: answers "in their voice and tone"; S-02: "voice cloning", "voice + personality continuity"; landing: "Use your voice — literally. We'll preserve it. Safely."; S-04/S-06: synthetic voice not approved. | Split into (a) **original voice recording and playback**, which is in MVP, and (b) **synthetic voice generation**, which is a sensitive function and requires founder approval (S-09). Recommended: post-MVP. | Gate G6 (DR-028) |
| **C-14** | **Who controls AI replies.** | S-02: "manual override of AI replies"; S-05 open question: does the parent approve a library of representative answers? | Merged into one PROPOSED requirement: the author can **review, correct, pin or suppress** answers in rehearsal. Pinned answers become author-approved evidence (E1). | Recommended (DR-030) |
| C-15 | Platform. | S-01/S-02 say React Native; S-04 notes this is not a web strategy. | **Recommended:** responsive web first; native apps after validation. | Gate G5 |
| **C-16** | **© 2024 on landing visuals.** | The project started 29 May 2025 (S-06). | Image-generation artefact. Correct before any publication. | Resolved |
| C-17 | Legal entity. | "Quintessence Intelligence (Pty) Ltd" (S-03, S-06) vs "Quintessence Intelligence" (all others). | Use "Quintessence Intelligence" for brand attribution. Legal entity, IP ownership and trademarks remain UNRESOLVED. | OQ-50 |
| C-18 | Former name "Hey Daddy". | S-04 only. | Recorded as **superseded**. Echo of Me is CONFIRMED. | Resolved |
| C-19 | Audience breadth. | S-04 allows expansion beyond parents; S-05/S-06 are parent-to-child. | Compatible. Parents are the primary focus; expansion is a future option. | Resolved |
| C-20 | Contents of the original research report. | S-06 describes its opening; S-03 reconstructs the rest. | Only the opening is a probable fragment (HG-3). Full grading in **R8 §4**. The original is still missing (M-01). | Open (R5 OQ-01; non-blocking, DR-048) |
| **C-21** | **Lifenaut description is internally inconsistent in S-02** ("nonprofit… conceptual" vs "open source"). Other competitor claims are dated 2025. | S-02 §3 vs §4 | Treat all competitor claims as **HISTORICAL, UNVERIFIED**. Refresh with dated sources (doc 02 research). | Open |
| **C-22** | **Positioning tension.** | S-02: "continue receiving support, wisdom, and comfort"; "A companion when they need it most"; landing: "Train an AI version of yourself… think and speak like you". S-04/S-06/S-08: not a replacement parent; no claims of literal consciousness; avoid dependency. | Founder governance (S-08) prevails. Historical copy is preserved as HISTORICAL and must be rewritten before publication. | Resolved |
| C-23 | Visual direction. | S-06: holographic brain, orange/gold neurons, deep blue control room. S-04/S-08: cosmic navy, teal glow, purple QI logo. The S-10/S-11 images also show an amber/orange glow on the face silhouette. | **Approved direction:** cosmic navy + restrained teal + purple QI logo (S-08). The amber accent visible in the images is **unconfirmed**. The S-06 brainstorm is HISTORICAL exploration. | Resolved; amber = OQ-47 |
| C-24 | Three incompatible decision-ID schemes (DEC-xxx, D-xxx, table rows). | S-04, S-05, S-06 | New canonical **DR-xxx** IDs with a crosswalk in R2 §5. | Resolved |
| C-25 | Two decision vocabularies. | S-08/S-04: LOCKED/PROPOSED/DRAFT/UNRESOLVED/ESTIMATE. S-09/S-05/S-06: CONFIRMED/… | S-09 prevails. Mapping: LOCKED→CONFIRMED; ESTIMATE→HISTORICAL; DRAFT→PROPOSED (or HISTORICAL for old artifacts); WORKING DIRECTION→PROVISIONAL; HANDOFF RECOMMENDATION→PROPOSED. | Resolved |
| **C-26** | **Feedback Loop vs adult-only MVP.** | S-05 confirms a child-facing concept; S-04/S-06 recommend no minors in v1. | No contradiction in principle: the concept is **preserved** (CONFIRMED CONCEPT) and **scheduled post-MVP** behind an ethics/child-development review and founder approval (child profiling is a sensitive function under S-09). | Gate G7 (DR-029) |
| C-27 | Document numbering collision. | S-04/S-07 use `01_`/`02_`; S-08 reserves `02_`–`07_` for build docs. | New structure: foundation docs `01A`–`01D`, registers `R1`–`R7`, build docs `02`–`07` reserved (00 README). | Resolved |
| C-28 | Competing knowledge structures. | S-06 folder tree; S-05 16-document list; S-08 six docs; S-09 required registers. | Unified in 00 README §4. Each S-05/S-06 document type maps to a canonical home. | Resolved |
| C-29 | Answer classification schemes. | S-04: quoted/retrieved/synthesized/unknown. S-05: directly/partially/unsupported. S-06: documented/inferred/unsupported. S-08: direct recordings/author quotes/human-approved summaries/AI inference. | Unified **two-axis taxonomy**: source provenance P1–P6 and answer evidence E1–E3 (01B §4.3). PROPOSED for gate G4. | Recommended |
| C-30 | Lifecycle states. | S-04 persona states (draft/active/frozen/archived) vs S-06 eight posthumous states. | Merged into one state model with "Frozen" as a content lock on activation (01B §4.10). PROPOSED. | Recommended |
| C-31 | Entity naming differs across three logical models (LegacyPersona/legacy_profiles; Recipient/beneficiaries/ChildProfile; TrustedContact/Guardian/custodian). | S-04, S-05, S-06 | Canonical glossary (01A §10) and unified entity catalogue (01B §4.2). Final schema is decided in doc 03. | Resolved (naming); schema open |
| C-32 | Status of the "Feedback Loop adjacent research". | S-05 says LENA / Thrive by Five were mentioned but never deeply researched. | HISTORICAL, UNVERIFIED. Research work package RW-03. | Open |
| **C-33** | **First-release module priority.** S-17 (original, 23 Jun 2025) plans to "select between Feedback Loop, Memory Canvas, or Echo Edit for first release". S-09 (founder, Nov 2026) makes modules 01–06 the MVP focus; 01D excludes 07–09. | S-17 vs S-09 | S-09 is the current founder governance and prevails **for now**. The 2025 intent is preserved as HISTORICAL (DR-049) and **not** declared superseded. The founder decides whether one differentiating module joins MVP-1 (OQ-56). Recommended: Memory Canvas as MVP-1.1 if any. | Open (OQ-56) |
| C-34 | Kanban stages. | S-17: backlog, in progress, ready, done. S-05: Backlog, Design, In Progress, Done. | The original (S-17) prevails as the historical record; stage design for the future board is open. | Resolved |
| C-35 | Pitch deck scope. | S-17: concept overview, branding, personas, modules, roadmap. S-05: also problem, Feedback Loop, Memory Canvas, creative video module, mockups, architecture, investor positioning, commercial potential. | Treat S-17 as the original brief and S-05's extras as reconstructed (HG-4) candidate content. | Resolved |
| **C-36** | **Retrospective reframing in S-03.** The 2025 originals frame the product as an AI "trained on parent data" that responds "in their voice and tone", a "living, evolving copy of conscience", with "voice cloning" and "voice + personality continuity". S-03 attributes to the 2025 research a "not immortality", "truthful AI", "evidence-linked", retrieval-based framing. | S-01/S-02 vs S-03 §2, §5, §6 | Both are preserved. **2025 wording = historical fact (HG-1).** **2026 framing = current charter policy (S-08, 01A), not history (HG-5).** The founder's governance deliberately moved the product toward truthfulness; this is a documented evolution, not a contradiction to hide. | Resolved (RK-27) |
| C-37 | Competitor set of the original report vs the Dossier. | Fragment (HG-3): the report opened with HereAfter AI, StoryFile, **StoryWorth / Living Wisely**. S-02 lists no StoryWorth or Living Wisely. | The original report probably covered a **wider** set than the Dossier summary. Unknown until M-01 is recovered. | Open (R8 Q-1) |
| C-38 | Module 09 name. | S-17 (original): "Echo Edit" (provisional). S-05: Personalized Echo → Echo Remix → The Echo Edit → Canvas preference → "Video Canvas / The Echo Edit". | "Echo Edit" is evidenced as the June 2025 working name (HG-1). The rest of the naming history and the Canvas preference are reconstructed (HG-4) but confirmed by S-09's module list. Final name still open (OQ-40). | Resolved (history) |
| C-39 | "Numbered module checklist with description and status" (S-05 DEC-015) vs the recovered checklist. | S-17 is a 7-task plan (task, subtasks, priority, deadline) with no module numbering or status. | Either a different artifact existed or S-05 describes it inaccurately. The numbered register now exists as 01C either way. | Resolved |

## 5. Landing-page visuals: claims and artefacts (S-10, S-11)

**Copy present (both unless noted):** "Because your love deserves a voice beyond time." · "Train an AI version of yourself that can guide, comfort, and speak to your children — even when you no longer can." · "Join the Waitlist" · "We're inviting 100 early families" · "What Is Echo of Me? An AI-powered legacy platform that helps you preserve your stories, values, and life lessons — and share them with your children when they need you most. Create your own digital conscience. Let them ask questions. Leave no wisdom unsaid." · Four pillars: "Write or speak your thoughts like journaling, but smarter" / "Train your AI conscience, built to think and speak like you" / "Leave answers they'll need later — by age, by event, by [truncated]" / "Use your voice — literally. We'll preserve it. Safely." · "Who It's For: If you're a parent, this is for you. For the moments you can't be there. For the words they haven't asked for yet. For the legacy you want to leave." · S-10 only: "Ethics & Privacy: We don't use your data to train anyone else's AI. You control everything — every word, every memory, every reply." · S-11 only: "Join the Waitlist: We're building this with the first 100 families. Help shape the future of emotional AI, and leave something unforgettable."

**Claims requiring verification or rewrite before publication:**

| Claim | Problem |
|---|---|
| "Train an AI version of yourself… speak to your children — even when you no longer can" | Overpromises representation; conflicts with P-01/P-02 |
| "built to think and speak like you" | Implies a persona simulation (Tier 3) and synthetic voice |
| "We'll preserve it. Safely." | Unverified security and permanence promise |
| "You control everything — every word, every memory, every reply" | Absolute claim; recipient rights, law and generated replies limit author control |
| "We don't use your data to train anyone else's AI" | Must become an enforced, contractually backed practice (including the AI vendor's terms) before it is stated |
| "We're inviting / building with the first 100 families" | Aspirational; no sign-up count exists |
| "Help shape the future of emotional AI" | Off-tone; reframe |

**Text-generation artefacts:** "8'2 QUINTESSENCE" (S-10 logo); "shate", "speek", "4I", "buit", "by Y", "Quinfessence", "logacy", "unseald", "At powered" (various); "© 2024" (wrong year).

## 6. Source disposition: PENDING FOUNDER DECISION (no action taken)

**Founder directive (DR-047): no source document is deleted, replaced, archived or declared superseded without explicit approval.** The v1.0 recommendation to archive S-03 to S-07 is **withdrawn as an action** and kept only as an option for later discussion. All sources stay in active Project knowledge, unchanged.

| Source | Current status (v1.1) | Option for founder (only if you choose) |
|---|---|---|
| S-01 Scope & Brief | **Primary historical source, active** | — |
| S-02 Full Dossier | **Primary historical source, active** | — |
| S-17 Master Checklist (Drive) | **Primary historical source** (repository archive copy) | Optionally add to Project knowledge as a file |
| S-03 Research Report (reconstructed) | **Provisional secondary reference, active**, graded in R8 | Retain as-is (recommended) |
| S-04 Master Handoff | Secondary reference, active | Later: move out of active knowledge to reduce retrieval of its module-less version. **Update the Project instructions first** (00 README §7). |
| S-05 Brief v1.0 | Secondary reference, active (sole detailed source for 07–10) | Retain (recommended) |
| S-06 Comprehensive Brief | Secondary reference, active | Later option as for S-04 |
| S-07 Decision & Delivery Register | Secondary reference, active | Later option |
| S-10–S-16 visuals and logos | Reference, active | — |

**Mitigation while everything stays active:** the canonical set (00 README, R1 ranking, R8 grades) tells Claude how to weigh each source, so leaving the reconstructions active is safe as long as the Project instructions point to the canonical set first.
