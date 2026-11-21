# Echo of Me | R2 Decision Register

| Field | Value |
|---|---|
| Document ID | R2 |
| Version | v1.5 |
| Date | 17 November 2026 |
| Status | CANONICAL (living register). Supersedes v1.4; all v1.4 content is carried below. v1.5 adds **DR-058** (dedicated Supabase account) and records slice-2 implementation notes on DR-020, DR-023 and DR-040 (no status of a product decision changed). |
| Consolidates | S-07 `02_Decision_and_Delivery_Register.md`; decision tables in S-04 §2.1, S-05 §2.2 (DEC-001…016), S-06 §2.1 (D-001…026). These sources are retained unchanged; none is declared superseded without founder approval (DR-047). |

## 1. Status vocabulary (per S-09, which prevails)

| Status | Meaning |
|---|---|
| **CONFIRMED** | Explicit founder-approved decision |
| **CONFIRMED FOR MVP** | Founder-approved **for the initial MVP only** (DR-052). It is **not** a permanent restriction on the wider Echo of Me vision; capabilities deferred by it stay on the roadmap. |
| **CONFIRMED CONCEPT** | Accepted product idea; implementation not yet approved |
| **PROVISIONAL** | Accepted working name or design direction |
| **PROPOSED** | Historical or new recommendation; **not** approved |
| **UNRESOLVED** | Requires a decision |
| **HISTORICAL** | Earlier technical or commercial assumption requiring validation |

Legacy labels are mapped as described in R6 C-25. **No entry may move to CONFIRMED (or CONFIRMED FOR MVP) without a dated founder approval recorded in §6.**

## 2. Decisions

### 2.1 Identity, purpose and principles

| ID | Decision | Status | Sources | Notes |
|---|---|---|---|---|
| DR-001 | Product name is **Echo of Me**. Former working reference "Hey Daddy" is superseded. | **CONFIRMED** | S-08; S-01; S-06 (named 12 Jun 2025); S-04 | Trademark and domain clearance still outstanding (OQ-49) |
| DR-002 | Primary tagline: **"Because your love deserves a voice beyond time."** | **CONFIRMED** | S-08; S-04; S-02 | Other lines are candidate secondary copy (R6 C-01) |
| DR-003 | Product is presented **"By Quintessence Intelligence"** | **CONFIRMED** | S-01; S-02; S-06 D-002 | Legal entity, IP and ownership UNRESOLVED (OQ-50) |
| DR-004 | Primary use case: **parent-to-child digital legacy**. Parents/guardians are the principal creators; children are the primary long-term beneficiaries. | **CONFIRMED** | S-05 DEC-002; S-06 D-004/005 | |
| DR-043 | Primary audience is parents; expansion to partners, grandparents, mentors and wider legacy remains possible | **CONFIRMED** (concept level) | S-04 §1.1, §2.1 | First customer focus stays on parents |
| DR-005 | Preserve memories, values, reasoning, wisdom, voice and love: a "copy of my conscience" **as a governed representation of recorded material, never a claim of literal consciousness** | **CONFIRMED** | S-08 (non-negotiable principle); S-05 DEC-003; S-06 D-003/008 | Founding phrase is kept verbatim |
| DR-006 | Knowledge accumulates **progressively over years** (lifelong, guided capture) | **CONFIRMED** | S-06 D-006; S-02; S-04 | |
| DR-007 | AI is used for natural-language interaction with the legacy | **CONFIRMED** | S-06 D-007 | MVP method: DR-022 |
| DR-009 | Legacy continuity after death is part of the vision | **CONFIRMED CONCEPT** | S-05 DEC-004 | Not live in MVP (DR-032); **posthumous interaction remains an important long-term requirement** (founder, 16 Nov 2026) |
| DR-010 | Pursue a scalable commercial offering and investor readiness | **CONFIRMED** | S-05 DEC-005; S-06 §1.6 | No business model approved; no budget approved (DR-054). Currently developed as a **non-commercial** project (DR-056) |
| DR-008 | Visual direction: **cosmic navy, restrained teal glow, purple QI logo**; warm, calm, non-sensational tone. Landing images are reference only. | **CONFIRMED** (direction only) | S-08; S-04 §2.4 | Not a design system. Amber accent unconfirmed (OQ-47) |

### 2.2 Governance, documentation and environment

| ID | Decision | Status | Sources | Notes |
|---|---|---|---|---|
| DR-011 | Maintain the **complete module catalogue 01–10 incl. 08A**; do not remove, rename, merge away or discard any module | **CONFIRMED** | S-09; founder 16 Nov 2026 | See 01C |
| DR-012 | Modules **01–06 are the initial MVP foundation**; build an MVP before broad expansion | **CONFIRMED FOR MVP** | S-09; S-06 D-010/011; founder 16 Nov 2026 | Detailed boundary in 01D |
| DR-035 | Maintain a numbered module checklist with description and status | **CONFIRMED** | S-05 DEC-015 | Fulfilled by 01C |
| DR-036 | Include a Notion-style board and a visual pitch deck in project outputs | **CONFIRMED** (request) | S-05 DEC-016; S-17 | Not yet delivered (M-07, M-08) |
| DR-039 | Produce six build documents 02–07 | **CONFIRMED** | S-08 | Written incrementally as slices land (PROPOSED approach) |
| DR-040 | Build in vertical slices: consent/onboarding → capture/provenance → secure retrieval → author preview → recipient roles/release → pilot telemetry | **CONFIRMED** | S-08 | Slice 1 built and tested 16 Nov 2026; **slice 2 built and tested 17 Nov 2026** (ADR-006; `canonical/build/Slice_2_Test_Results_v1.0.md`) |
| DR-041 | **No application build** until the product boundary, sensitive-data controls and AI response policy are sufficiently defined | **CONFIRMED** (relaxed by DR-051) | S-09 | MVP gates now decided (DR-052) |
| DR-031 | No confidential Echo of Me material goes to third-party services or connectors without a vendor review **and founder approval** | **CONFIRMED** (rule) | S-09; S-05 §2.9 | Test environment uses synthetic data only (DR-053) |
| DR-037 | Documentation structure, IDs and versioning per 00 README | **PROPOSED** (reversible working default) | New | Founder may amend |
| DR-047 | **Source-integrity directive** (no source deleted, replaced, archived or declared superseded without explicit founder approval; reconstructions are not historical fact unless corroborated) | **CONFIRMED** | Founder, 16 Nov 2026 | R8, R9, R1 v1.1 |
| DR-048 | The missing original research report must **not** block progress | **CONFIRMED** | Founder, 16 Nov 2026 | — |
| DR-051 | **Development may begin.** Founder keeps major product decisions; Claude makes routine technical decisions; priority is working software | **CONFIRMED** | Founder, 16 Nov 2026 22:35 | — |
| DR-050 | Adopt historical evidence grades HG-1…HG-5 (+RV) | PROPOSED (reversible method) | New | Founder may amend |
| DR-052 | **MVP gate decisions are scoped to the initial MVP** and do not permanently exclude any part of the vision (persona modelling, reasoning representations, fine-tuning, child-facing experiences, posthumous interaction, voice synthesis, mobile apps, modules 07–10). **Continue development without unnecessary approval cycles.** | **CONFIRMED** | Founder, 16 Nov 2026 ~23:19 | Applies to DR-012, 022, 023, 024, 026, 027, 028, 029, 032 |
| DR-053 | **Private development and test environment authorised** with conditions: private GitHub repo owned by QI; Supabase for dev database and auth; Vercel if the free tier permits the intended use; region preferably EU, with SA residency and POPIA considerations documented; restricted access; **synthetic data only**; everything under QI ownership; **no charges or automatic paid upgrades**; MFA on administrative access and a tested real authentication flow; no exposure of personal information or unauthorised functionality; secrets never committed; a private repo does not imply a private deployment; **no production deployment; no real customer or children's data**; no new organisation or paid account where a company-owned one exists; Claude asks the founder for steps needing account creation, credentials, permissions, billing or ownership verification; report repository, URL, region, access restrictions and checks performed. | **CONFIRMED** | Founder, 16 Nov 2026 ~23:19 | ADR-004, ADR-009. The "no new account" condition was relaxed by the founder's own action recorded in DR-058 |
| DR-054 | **BUDGET NOT YET APPROVED; ADDITIONAL SPENDING AUTHORITY: R0.** Free tiers and existing tools only; identify recurring charges first; no purchases, subscriptions or external developers without explicit approval; separate realistic estimate (legal/privacy review, security testing, pilot, launch) kept apart from spending authority. | **CONFIRMED** | Founder, 16 Nov 2026 ~23:19 | DR-033 re-estimate still required (doc 06) |
| **DR-056** | **Hosting for development: Vercel Hobby (free).** Founder's position: Echo of Me is **not commercial yet** and is being built as a hobby project until the need to commercialise it. Vercel's fair-use policy limits Hobby to non-commercial personal use, so: **move to a paid Vercel plan (or another compliant host) before any commercial use**, which needs spending approval under DR-054. Access restriction: only **preview deployments** are used until "All Deployments" protection is verified on the project, because Vercel documents that Hobby Standard Protection may leave the production domain public; the app keeps its own real sign-in in front of every page. | **CONFIRMED** | Founder, 16 Nov 2026 23:44 | Satisfies the DR-053 Vercel condition on the founder's judgement; ADR-009 |
| **DR-057** | **Least-privilege runtime.** Hosted app connects as `echo_app_login` (NOINHERIT; no access without `SET ROLE echo_app`); account provisioning via a narrow SECURITY DEFINER function; development sign-in automatically refused on any hosted deployment. | **Implemented** (technical decision under DR-051) | ADR-005 v1.1 | Evidence: `tests/hosting-safety.test.ts` (extended in slice 2 to the vault tables and local media storage) |
| **DR-058** | **Dedicated Supabase account for Echo of Me.** The founder created echo-of-me@quintessenceintelligence.com (company-owned, MFA on) as Owner of a separate Supabase organisation "Echo of Me" (free plan) holding project `cvyoicwcsbxmhjuslixv` (eu-west-1); the founder's usual login is a Developer member. This relaxes the DR-053 condition "no new organisation or paid account where a company-owned one exists" for this purpose (no paid account; ownership stays with QI). | **CONFIRMED** (founder action) | Founder, 17 Nov 2026 00:14 | Handoff §0.2–0.3 (connector is single-organisation; switching procedure) |

### 2.3 Module concepts

| ID | Decision | Status | Sources |
|---|---|---|---|
| DR-013 | **Feedback Loop** (child-informed parent reflection), with explicit consent, non-diagnostic observations and anti-profiling safeguards | **CONFIRMED CONCEPT** | S-05 DEC-010; S-09 |
| DR-014 | **Memory Canvas** = emotional image generation module | **CONFIRMED CONCEPT**; name **PROVISIONAL** | S-05 DEC-011; S-09 |
| DR-015 | Playful self-image generation (08A) sits under Memory Canvas | **CONFIRMED CONCEPT** | S-05 DEC-012; S-09 |
| DR-017 | Video personalisation module ("Video Canvas / The Echo Edit") | **CONFIRMED CONCEPT**; final name **UNRESOLVED**; Canvas-family preference **CONFIRMED** | S-05 DEC-013/014; S-09; S-17 |
| DR-018 | **Timed & Milestone Messages** module | **CONFIRMED CONCEPT**; triggers PROPOSED | S-09; S-02 §5; S-05 §3.4 |
| DR-019 | Guided, community-informed prompts to surface overlooked wisdom | **CONFIRMED CONCEPT** | S-06 D-009; S-01; S-02 |
| DR-045 | Family/friend contributor layer (labelled as contributor-authored) | **PROPOSED** (post-MVP) | S-06 D-024, §1.4, §4.11 |
| DR-055 | **Memory Canvas (08) as the first post-MVP add-on** (OQ-56) | **PROVISIONAL** recommendation only, **not an approved priority** | Founder, 16 Nov 2026 |

### 2.4 MVP decisions (gates G1–G7)

| ID | Decision | Status | Gate | Founder qualification (16 Nov 2026) |
|---|---|---|---|---|
| DR-024 | MVP capability scope: **Tier 1 Interactive Memory + constrained Tier 2 Values-Grounded Guidance** | **CONFIRMED FOR MVP** | **G1** | Persona modelling, reasoning representations and Tier 3 are **future possibilities, not permanently excluded** |
| DR-026 | MVP recipients are **adults only**; minors exist only as records with no login | **CONFIRMED FOR MVP** | **G2** | **Child-facing experiences remain an important long-term requirement** |
| DR-025 | Pilot: 10–20 consenting adult author households, about 6 weeks, after the MVP build | PROPOSED (not addressed) | G2 | — |
| DR-032 | **No posthumous activation in the MVP.** Living-author preview and author-initiated sharing; posthumous release designed, not live. | **CONFIRMED FOR MVP** | **G3** | **Posthumous interaction remains an important long-term requirement** |
| DR-022 | AI method for MVP: **source-grounded responses using parent-recorded and author-approved information (RAG first); no fine-tuning in MVP**; model-independent canonical sources; provider-portable | **CONFIRMED FOR MVP** | **G4** | **Fine-tuning remains a future possibility** |
| DR-023 | Answer policy: **citations on grounded answers; no unsupported guessing**; AI identity always disclosed | **CONFIRMED FOR MVP** (principle); P1–P6 / E1–E3 taxonomy remains the PROPOSED implementation design | **G4** | Slice 2 implements the P1–P6 source side as a working default (ADR-006): only approved P1/P2/P3 material is citable, via the `citable_source` view |
| DR-030 | Author can review, correct, pin or suppress AI answers during rehearsal | PROPOSED (working default) | G4 | — |
| DR-021 | No personal content from one family used for another family or in model training; MVP prompts editorial only | PROPOSED (working default; consistent with DR-022) | G4 | — |
| DR-044 | "Teach / train your Echo" is product language, never presented as fine-tuning or the AI becoming the author | PROPOSED | G4 | — |
| DR-020 | Persistent, structured, versioned memory as the knowledge base | PROPOSED (implemented as working default; ADR-006: append-only versions, approval per version) | G4 | — |
| DR-027 | MVP platform: **responsive web first; text and audio capture** (original preserved; optional still images); video deferred | **CONFIRMED FOR MVP** | **G5** | **Preserve a practical path to future mobile experiences.** Slice 2 implements text, in-browser audio recording/upload with byte-identical originals, and optional still images; video is refused |
| DR-033 | Historical schedule (12–14 weeks) and budget (US$20,500–30,000) are not commitments; re-estimate in doc 06 | **HISTORICAL** | G5 | See DR-054 |
| DR-028 | **No voice cloning in the MVP.** Secure audio capture and preservation of original recordings retained. | **CONFIRMED FOR MVP** (sensitive function) | **G6** | **Future voice synthesis remains possible, subject to explicit consent and safeguards** |
| DR-029 | **Feedback Loop not in the MVP**; preserved in the backlog; child data only after ethics review, guardian-consent design and founder approval | **CONFIRMED FOR MVP** (sensitive function) | **G7** | Module preserved (DR-011, DR-013) |
| DR-042 | MVP roles: Author; adult Recipient; Trusted Contact (record only); Platform Administrator (no default content access) | PROPOSED (implemented as working default in slice 1) | G2/G3 | — |
| DR-038 | Primary jurisdiction assumed **South Africa (POPIA)** | PROPOSED (assumption) | G5 | Dev region EU (eu-west-1); SA residency to be documented (DR-053) |
| DR-016 | Foundation model / provider | **UNRESOLVED** | ADR-007 | Must respect DR-054 (R0). Needed for slice 3 and for automatic transcription |

### 2.5 Historical items (kept for context, not commitments)

| ID | Item | Status | Sources |
|---|---|---|---|
| DR-034 | 2025 tech shortlist: React Native; FastAPI or Node.js; PostgreSQL + Firebase; Auth0 or Firebase Auth; GPT-4 Turbo → GPT-4o; LangChain; Whisper; ElevenLabs; Vercel/Render/AWS | **HISTORICAL** | S-01 §7; S-02 §6; S-03 §6; S-04 §4.7; S-05 §2.4; S-06 §4.1 |
| DR-049 | June 2025 plan: choose the first-release module from Feedback Loop, Memory Canvas or Echo Edit | **HISTORICAL** (HG-1); not superseded | S-17 |
| DR-046 | Pre-launch marketing approach (landing page, waitlist, "Legacy Circle", partnerships, ethical-AI press) | **HISTORICAL** (draft) | S-04 §3.4 |

## 3. Decision gates

| Gate | Outcome (16 Nov 2026) | Linked DRs |
|---|---|---|
| **G1 Product boundary** | **Decided for MVP:** Tier 1 + constrained Tier 2; persona etc. future possibilities | DR-024, DR-052 |
| **G2 Recipient cohort** | **Decided for MVP:** adults only; minors as records. Pilot design still PROPOSED | DR-026, DR-025, DR-042 |
| **G3 Access release** | **Decided for MVP:** no posthumous activation | DR-032 |
| **G4 AI output & data use** | **Decided for MVP:** source-grounded, cited, no unsupported guessing, no fine-tuning. Pin/suppress and cross-family rule remain working defaults | DR-022, DR-023, DR-030, DR-021 |
| **G5 Platform & budget** | **Platform decided for MVP:** web first, text + audio, mobile path preserved. **Budget not approved; R0** | DR-027, DR-054 |
| **G6 Synthetic voice** | **Decided for MVP:** no; original recordings preserved | DR-028 |
| **G7 Child data** | **Decided for MVP:** not in MVP; preserved in backlog | DR-029 |

## 4. Change control
- A founder approval is recorded in §6 with date, wording and the DR IDs it affects. The DR status changes and the doc version increments.
- Superseding a decision: keep the old row, mark it **SUPERSEDED by DR-xxx**, and add the new row.

## 5. Crosswalk from historical decision IDs

| Historical ID | Canonical | Historical ID | Canonical |
|---|---|---|---|
| S-05 DEC-001 | DR-001 | S-06 D-001 | DR-001 |
| DEC-002 | DR-004 | D-002 | DR-003 |
| DEC-003 | DR-005 | D-003 | DR-005 |
| DEC-004 | DR-009 | D-004, D-005 | DR-004 |
| DEC-005 | DR-010 | D-006 | DR-006 |
| DEC-006, DEC-007 | DR-016 | D-007 | DR-007 |
| DEC-008 | DR-020 | D-008 | DR-005 |
| DEC-009 | DR-042 | D-009 | DR-019 |
| DEC-010 | DR-013 | D-010, D-011 | DR-012 |
| DEC-011 | DR-014 | D-012 | DR-034 / DR-027 |
| DEC-012 | DR-015 | D-013, D-014, D-017, D-019, D-020, D-021 | DR-034 |
| DEC-013, DEC-014 | DR-017 | D-015, D-016 | DR-016 |
| DEC-015 | DR-035 | D-018 | DR-028 / DR-034 |
| DEC-016 | DR-036 | D-022, D-023 | DR-042 |
| S-04 "Project identity" | DR-001/002/003 | D-024 | DR-045 |
| S-04 "Primary audience" / "Product shape" | DR-043 / DR-006 | D-025, D-026 | DR-033 |
| S-04 "Author input" / "Family access" | DR-027 / DR-026 | S-04 "AI architecture" / "Voice" | DR-016, DR-022 / DR-028 |
| S-04 "Deployment" / "Pilot" | DR-034 / DR-025 | S-04 "Visual system" / "Marketing" | DR-008 / DR-046 |

## 6. Founder approval log

| Date | Approval (verbatim or summarised) | DRs affected | Recorded by |
|---|---|---|---|
| 2026-11-16 | Founder confirmed S-03 regenerated in ChatGPT; S-01/S-02 genuine; directed source-integrity rules; missing report must not block progress. | DR-047, DR-048 | Claude |
| 2026-11-16 22:35 | "Development can begin"; routine technical decisions delegated; major product decisions retained; priority is working software | DR-051 | Claude |
| 2026-11-16 22:44 | Founder ("you do it") authorised removal of outdated Claude-authored canonical copies from Project knowledge. No source document touched. | — | Claude |
| 2026-11-16 ~23:19 | **Question 1 (MVP gates): "Accept most, with qualifications."** Record as CONFIRMED FOR MVP, not permanent restrictions (full qualifications in §2.4 and DR-052). Memory Canvas as first add-on is provisional only. "Continue development without unnecessary approval cycles." | DR-052, DR-012, DR-022, DR-023, DR-024, DR-026, DR-027, DR-028, DR-029, DR-032, DR-055; G1–G7; OQ-56 | Claude |
| 2026-11-16 ~23:19 | **Question 2 (test environment): "Yes, set it up, with conditions."** | DR-053; ADR-004, ADR-009; OQ-52 | Claude |
| 2026-11-16 ~23:19 | **Question 3 (budget): "Decide later."** "BUDGET NOT YET APPROVED; ADDITIONAL SPENDING AUTHORITY: R0." | DR-054; OQ-41; DR-033 | Claude |
| 2026-11-16 23:44 | Founder: "repository created" (`QuintessenceIntelligence/echo-of-me`, private); Supabase dashboard shows only one project in the QI organisation; **"Remember this is not commercial yet... and I'm building it as a hobby until the need to commercialise it."** | DR-056 (new); OQ-52 closed (repo exists) | Claude |
| **2026-11-17 00:14** | Founder created the dedicated company-owned Supabase account echo-of-me@quintessenceintelligence.com (MFA on), organisation "Echo of Me" and project `cvyoicwcsbxmhjuslixv`; usual login invited as Developer. | **DR-058** (new); DR-053 condition relaxed | Claude (recorded 17 Nov 2026 ~01:40) |
