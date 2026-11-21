# Echo of Me | R9 Research Refresh Plan

| Field | Value |
|---|---|
| Document ID | R9 |
| Version | v1.0 |
| Date | 16 November 2026 |
| Status | **PROPOSED** plan (reversible; no external commitments) |
| Inputs | R8 (claim grades); R5 research work packages RW-01–RW-12; S-08 research requirements |

## 1. Rules for the refresh (no silent overwriting)
1. **Historical material is never edited.** The 2025 originals, the reconstructions and the canonical "historical" sections stay as they are.
2. Every refreshed finding goes into a separate, dated **Research Refresh (RR)** document. Each row records: the *2025 historical claim (with grade)*, the *2026 verified finding*, the *source link*, the *access date*, and the *delta* (confirmed / changed / not found / new).
3. Every material external fact links to a primary or reputable source. Otherwise it is marked **UNVERIFIED** (S-08). No invented prices, user counts, capabilities, partnerships or legal conclusions.
4. Legal findings are **orientation only**, marked ⚖ for qualified review. They are never compliance claims.
5. Canonical documents (01B, R2, 02–07) then **reference** the RR rows. Historical rows stay visible next to the current ones.

## 2. Refresh workstreams and the documents they feed

| RR doc | Scope | Feeds | Needed before | Priority |
|---|---|---|---|---|
| **RR-01 Competitor & Adjacent Product Refresh** | All 2025-named competitors plus new entrants (§3) | 02 PRD, positioning, investor pack | Doc 02 | P1 |
| **RR-02 AI & Media Technology Landscape** | LLM providers, retrieval, transcription, voice, image, video and music tech (§4) | 03, 04, ADRs, 06 costs | Docs 03/04 | **P0** |
| **RR-03 Privacy, Legal & Ethics Landscape** ⚖ | POPIA and other target jurisdictions, children, deceased persons, synthetic media, consumer law (§5) | 05, 01D gates G2/G3/G6/G7 | Doc 05 | **P0** |
| **RR-04 Market, Segments & Willingness to Pay** | Demand evidence, segment hypotheses, pricing benchmarks (§6) | 02, 06, commercial pack | Pilot design; investor work | P1 |
| **RR-05 Architecture Revalidation** | 2025 stack items against 2026 options (§7) | 03 ADRs | Doc 03 | **P0** |

## 3. RR-01: Competitor refresh (all 2025 claims are HG-1/3/4 + RV)

| Entity | 2025 historical claim (grade) | What to verify now |
|---|---|---|
| HereAfter AI | Voice stories; pre-recorded Q&A (HG-1) | Still operating? Any generative answers? Pricing; data/privacy terms; child use |
| StoryFile | Indexed recorded video; no generation (HG-1) | Corporate status; product changes; pricing |
| You, Only Virtual (YOV) | "Closest match"; Versonas from emails, texts, voice (HG-1) | Current offering; consent model; posthumous use; claims about authenticity |
| Eternime | Did not launch fully (HG-1) | Defunct or active |
| Replika | Companion, not legacy (HG-1) | Relevance; regulatory actions affecting companion AI (useful precedent) |
| Lifenaut | Nonprofit / "open source", early stage (HG-1, internally inconsistent) | Status; correct characterisation |
| SafeBeyond | Non-AI milestone messages (HG-1) | Status; features informing Module 10 |
| StoryWorth; Living Wisely | Prompted storytelling / values (HG-3) | Status; prompt-library patterns (Module 05) |
| Eter9; LifeChronicles / ethical wills; Microsoft persona patent; MIT Augmented Eternity; Terasem | Mixed HG-1/HG-4 | Status; relevance as prior art or research |
| LENA System; Thrive by Five | Feedback Loop adjacent (HG-4) | Methods; consent and child-data practices (RW-03) |
| **New entrants since mid-2025** | — | Digital-legacy, "griefbot", AI memoir, family-history and AI-avatar products; big-tech features touching memorials or legacy |

**Output:** a feature matrix using the S-03 §4 grid as the template (rows: guided capture, milestone delivery, realism, generative Q&A, **explicit values/reasoning**, **evidence-linked answers**, **child-specific access**, posthumous governance, export/portability, pricing). Plus a differentiation verdict: does the Echo of Me wedge (01A §5) still hold?

## 4. RR-02: AI and media technology refresh

| Area | 2025 historical item (grade) | 2026 questions |
|---|---|---|
| Foundation models | GPT-4 Turbo (HG-1); GPT-4o (HG-4) | Which current models (several providers) best handle grounded generation, citation fidelity and abstention? Data-use and retention terms (no training on customer data)? Regional processing and South African cross-border implications? Price per 1k answers? Deprecation policies? |
| Retrieval | "Embeddings" (S-07); LangChain (HG-1) | Vector options (e.g. Postgres extension vs managed); hybrid search; citation-span grounding; whether an orchestration framework is needed at all |
| Grounding evaluation | None historical | Current faithfulness and attribution evaluation methods and tooling (RW-05) |
| Transcription | Whisper (HG-1) | Accuracy on South African English accents and code-switching; diarisation; hosted vs self-hosted cost; privacy terms |
| Voice synthesis / cloning | ElevenLabs "or similar" (HG-1) | Consent and verification features; watermarking/provenance; posthumous-use terms; misuse safeguards (for G6, post-MVP) |
| Image generation (Module 08/08A) | None historical | Likeness and IP policies; content credentials/labelling; cost |
| Video, music ID, licensed music (Module 09) | None historical | Music recognition options; licensed stock music; platform terms on reusing social video |
| Safety tooling | None historical | Crisis/self-harm classifiers and safe-messaging guidance; prompt-injection defences |

## 5. RR-03: Privacy, legal and ethics refresh ⚖ (orientation only)

| Topic | Why | Questions for qualified review |
|---|---|---|
| **POPIA** (South Africa) | Primary jurisdiction (A-09) | Lawful basis and consent for special personal information (health, beliefs, children); children's personal information and competent-person consent; cross-border transfer conditions for cloud AI vendors; Information Officer duties; data-subject rights; operator agreements; Information Regulator guidance current as of 2026 |
| Deceased persons' data and digital estates | Posthumous release (G3) | Status of a deceased author's personal information; executor and heir authority; recipient rights; how other jurisdictions treat this |
| Synthetic media, likeness and voice rights | Voice (G6), Canvas (08A), Video Canvas (09) | Personality/likeness rights in SA; post-mortem digital-replica laws in other target markets; disclosure/labelling duties for AI-generated content and chatbots (e.g. EU rules, if Europe is ever targeted) |
| Children | G2, G7, Module 07 | SA Children's Act and POPIA child provisions; age of consent for processing; profiling restrictions; mandatory-reporting duties on abuse disclosures |
| Consumer protection and marketing claims | RK-17 landing copy | Rules on claims about permanence, privacy and AI capabilities; subscription and cancellation terms |
| Copyright and music | Module 09 | Transformative use; music licensing; platform terms |
| Ethics and grief | RK-03, RK-25 | Current guidance on griefbots and "deadbots"; bereavement-informed design (RW-08) 🩺 |

## 6. RR-04: Market refresh
- **2025 claims to revalidate:** an opportunity among "digitally aware parents, especially those concerned with legacy, estate planning, or terminal care" (HG-1); segments parents 28–50, estate-planning families, terminally ill, expatriate/military, referral partners (HG-4).
- **Questions:** evidence of demand (surveys, search interest, competitor traction); willingness to pay for creation vs decades-long preservation; SA vs international market; channels (estate planners, insurers, financial advisers); sensitivities by culture and religion around posthumous representation.
- **Output:** TAM/SAM/SOM **only** with explicit, sourced assumptions (RW-12), plus interview guide inputs for discovery (RW-02).

## 7. RR-05: Architecture recommendations to revalidate
| 2025 recommendation (grade) | Revalidation question | Decision vehicle |
|---|---|---|
| React Native for "web + app" (HG-1) | Is responsive web (DR-027) sufficient for audio capture and accessibility? | ADR-001 Client platform |
| FastAPI or Node.js (HG-1) | Which suits AI pipelines, team skills and hosting? | ADR-002 Backend runtime |
| PostgreSQL + Firebase (HG-1) | Single Postgres with row-level security and vector extension vs split services; POPIA residency | ADR-003 Data platform |
| Auth0 or Firebase Auth (HG-1) | MFA, step-up auth, identity proofing, cost | ADR-004 Identity |
| GPT-4 Turbo / GPT-4o (HG-1/HG-4) | Provider-portable model layer; evaluation-led choice | ADR-005 Model provider abstraction |
| "Trained" chatbot (HG-1) vs RAG (HG-5 proposal) | Confirm RAG-first with the evaluation harness | ADR-006 Grounding method (G4) |
| LangChain (HG-1) | Framework vs thin custom orchestration | ADR-007 Orchestration |
| Whisper (HG-1) | Accuracy and privacy (RR-02) | ADR-008 Transcription |
| Vercel / Render / AWS (HG-1) | Region, POPIA, cost, operations | ADR-009 Hosting & region |
| ElevenLabs (HG-1) | Post-MVP only (G6) | Deferred |

## 8. Sequencing and effort (indicative, Claude research time)
1. **Now, in parallel with docs 04/05:** RR-02 (AI tech) and RR-03 (legal orientation). About 1–2 working sessions each.
2. **Before doc 03 ADRs:** RR-05, built on RR-02.
3. **Before doc 02 finalisation and investor work:** RR-01 and RR-04. About 1–2 sessions each.
4. **Qualified legal review** (external, a cost) after RR-03. This needs founder approval because it is an external financial commitment.

Searching the web and recording sources is safe and reversible, so Claude can start RR-02 and RR-03 without further approval. No external services are engaged and no confidential material is shared (DR-031).
