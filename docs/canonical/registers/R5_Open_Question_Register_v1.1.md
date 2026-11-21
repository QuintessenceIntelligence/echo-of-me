# Echo of Me | R5 Open Question Register

| Field | Value |
|---|---|
| Document ID | R5 |
| Version | v1.1 |
| Date | 16 November 2026 |
| Status | CANONICAL (living register) |
| Consolidates | S-04 §5.1–5.3; S-05 §5.1–5.2; S-06 §5.1, §5.3; S-07; R6 open conflicts |

**Priority:** P0 = blocks MVP specification or build · P1 = needed before pilot · P2 = later roadmap. "Recommended default" is a **PROPOSED** answer to accelerate the decision; it is not approved.

## 1. Evidence and documentation

| ID | Question | P | Sources | Recommended default | Owner |
|---|---|---|---|---|---|
| OQ-01 | **Can the original `AI_Legacy_Project_Research_Report_v2.docx` (M-01) be recovered?** Drive, Gmail, QI mailbox and M365 were searched without success (R8 §7.1). | P1 (non-blocking, DR-048) | R1 M-01; R8 | Founder opens the June 2025 ChatGPT conversation and copies the `python-docx` script or the conversation (R8 §7.2); if recovered, register it as S-18 and rerun R8 §4 | Founder |
| OQ-02 | ~~Confirm S-01 and S-02 are unaltered 2025 originals~~ | — | A-06 | **CLOSED 16 Nov 2026**: founder-confirmed (DR-047) | Founder |
| OQ-03 | Should any source be moved out of active Project knowledge, and should the Project instructions be updated (00 README §7)? **Nothing happens without explicit founder approval (DR-047).** | P2 | R6 §6 | Keep everything active for now; update the instructions so Claude reads the canonical set first | Founder |
| OQ-04 | Confirm the mapping of the three historical conversations | P2 | A-20 | Low impact; may be skipped | Founder |

## 2. Product boundary

| ID | Question | P | Sources | Recommended default | Gate |
|---|---|---|---|---|---|
| OQ-05 | What is the **first core promise**: permanent memory library, source-grounded family Q&A, "AI conscience", or posthumous dialogue? | **P0** | S-04 §5.1 q1; S-06 P0 | Source-grounded living legacy (library + grounded Q&A); conscience as a values layer; posthumous dialogue later | G1 |
| OQ-06 | Is launch a living-parent capture tool, a bereavement-facing tool, or both? | **P0** | S-05 §5.2 | Living-parent capture first | G1/G3 |
| OQ-07 | Who is the MVP target user and payor (living parent with young children; adult child co-authoring with a living parent; estate-planning customer)? | **P0** | S-04 §5.1 q2 | Living parent with children, self-paying | G1 |
| OQ-08 | What minimum content makes Q&A helpful rather than hallucination-prone? | **P0** | S-04 §5.1 q4 | Q&A unlocks after ≥5 approved memories; show a coverage indicator | G4 |
| OQ-09 | How far may the AI extrapolate beyond explicitly recorded beliefs, and how is uncertainty shown? | **P0** | S-05 §5.2; S-06 P0 | Constrained Tier 2 only: grounded interpretation (E2) with citations and stated limits; no predictions about new people or events | G1/G4 |
| OQ-10 | What evidentiary threshold permits a response *as* the parent's perspective? | **P0** | S-05; S-06 P0 | Only E1 may be phrased as the author's view; E2 is always framed as "based on what they recorded…" | G4 |
| OQ-11 | Must every synthesised answer link to original sources? | **P0** | S-05 | Yes, for E1 and E2 | G4 |
| OQ-45 | How are original author responses and inferred AI utterances visibly separated? | **P0** | S-04 §5.1 q3 | Badge per answer (Direct / Interpretation / Not recorded) plus source cards | G4 |

## 3. AI Conscience Engine

| ID | Question | P | Sources | Recommended default | Gate |
|---|---|---|---|---|---|
| OQ-12 | How are conflicting beliefs recorded at different times handled? | P0 | S-05; S-06 §4.13 | Present the most recent with a date; disclose the earlier view; never silently merge | G4 |
| OQ-13 | Does the author approve a library of representative answers during their lifetime? | P1 | S-05; **S-02 "manual override"** | Yes: rehearsal pin/suppress (DR-030) | G4 |
| OQ-14 | Behaviour when evidence is limited | P0 | S-06 P1 | Abstain (E3) and offer adjacent memories; invite the author to record (in preview) | G4 |
| OQ-15 | AI evaluation metrics and pass thresholds | P1 | S-06 §5.6 | Proposed thresholds in 01D §5; finalised in doc 04 | G4 |
| OQ-16 | Foundation model and provider (DR-016) | P1 | S-01; S-02; S-05 | ADR comparing current providers on privacy terms, groundedness, cost, latency and SA data-transfer implications | doc 03 |
| OQ-17 | Cross-language questions, translation and voice attribution | P2 | S-06 §4.13 | Out of MVP scope; answer in the source language with a translation label | — |

## 4. Recipients, minors and release

| ID | Question | P | Sources | Recommended default | Gate |
|---|---|---|---|---|---|
| OQ-18 | May minors chat directly in MVP? | **P0** | S-04 §5.1 q6; S-06 P0 | No (DR-026) | G2 |
| OQ-19 | Which content is accessible while the author is alive vs after verified death or a milestone? | **P0** | S-04 §5.1 q5 | Per-item release rule: *share now* / *on milestone* / *after verified death*; MVP executes *share now* only | G3 |
| OQ-20 | Are sibling experiences shared, individual or independently permissioned? | P1 | S-05 | Independently permissioned per recipient, with a "shared with all children" shortcut | G2 |
| OQ-21 | How is posthumous activation verified? | P1 | S-06 P1; S-04 TrustedContact | Two-party human review (trusted contact + documentary evidence) + waiting period + author-set rules; legal review | G3 |
| OQ-22 | Who controls records after the author's death (executor, custodian, heirs)? | P1 | S-04 §5.1 q8; S-05 | The author nominates a custodian with bounded powers (suspend, not edit); legal review | G3 |
| OQ-23 | What independent rights do grown children obtain (e.g., turning 18)? | P1 | S-05 | Recipient gains own account rights over their copy and their own data; legal review | G3 |
| OQ-24 | How are disputes, account recovery and legal succession handled? | P1 | S-05; S-06 | Human-reviewed dispute workflow; suspension state | G3 |
| OQ-25 | Are amendments allowed after death? Third-party/family contributions? | P2 | S-04 §5.1 q8; S-06 P2 | Author corpus is frozen on activation; contributions are a separate labelled layer (DR-045) | — |
| OQ-54 | Pilot cohort composition, including whether vulnerable groups (terminally ill, bereaved) are ever included | P1 | S-04 §3.5 | Adults only; vulnerable groups only under an ethics-reviewed protocol later | G2 |

## 5. Voice and media

| ID | Question | P | Sources | Recommended default | Gate |
|---|---|---|---|---|---|
| OQ-26 | Voice strategy: original-audio archive only for MVP, or generated voice later? | **P0** | S-04 §5.1 q7; S-06 P1 | Original audio only (DR-028) | G6 |
| OQ-27 | Is video capture in MVP? | P1 | R6 C-06 | No; still images optional | G5 |
| OQ-55 | Video avatar roadmap | P2 | S-06 P2 | Not planned; revisit after pilot | — |

## 6. Feedback Loop (Module 07)

All are post-MVP but must be answered before Module 07 is specified (S-05 §5.2).

| ID | Question | P | Recommended default |
|---|---|---|---|
| OQ-28 | Which age bands are supported and who determines eligibility? | P2 | Guardian-determined; start ≥ 8 years; banded activities; child-development review |
| OQ-29 | Do parents initiate activities, or do children interact independently? | P2 | Parent/guardian-initiated, co-present sessions first |
| OQ-30 | Is the goal educational reflection, assessment, or both? | P2 | Reflection only; never assessment |
| OQ-31 | How are observations, uncertainty and possible bias communicated? | P2 | Plain-language, low-confidence, evidence-linked observations; no trait labels |
| OQ-32 | How may children see, correct or delete observations about themselves? | P2 | Child-visible summaries; deletion on request by child or guardian |
| OQ-33 | What is shared with parents, and what may stay private to the child? | P2 | Needs child-rights and legal review ⚖🩺 |
| OQ-34 | How are distress, abuse disclosures and parental misuse handled? | P2 | Safeguarding protocol, escalation and mandatory-reporting review ⚖🩺 |

## 7. Creative modules (08, 08A, 09)

| ID | Question | P | Recommended default |
|---|---|---|---|
| OQ-35 | Which Memory Canvas styles are allowed (realistic, symbolic, illustrative)? How are generated images labelled? | P2 | Symbolic/illustrative by default; "AI-generated" label always shown |
| OQ-38 | Likeness consent, reference-photo use and character/IP rules for playful imagery (e.g., "Superman") | P2 | Own-likeness only, with consent; generic heroes rather than trademarked characters unless licensed ⚖ |
| OQ-39 | Is a Video Canvas URL a reference only or an import mechanism? Which footage, soundtrack, transcript and narration uses are licensable? | P2 | Reference only; import only user-owned or licensed media ⚖ |
| OQ-40 | Final "Canvas" naming convention for module 09 | P2 | "Video Canvas" (sub-brand "The Echo Edit" optional) |

## 8. Release triggers (Module 10)

| ID | Question | P | Recommended default |
|---|---|---|---|
| OQ-48 | Which trigger types (date, birthday, age, milestone, verified death), and how are life events verified? | P1 | Date/age triggers first; life events confirmed by the recipient or custodian; death through the G3 process |

## 9. Commercial, legal and brand

| ID | Question | P | Sources | Recommended default |
|---|---|---|---|---|
| OQ-36 | Target launch markets and jurisdictions | P1 | A-09 | South Africa first (POPIA) |
| OQ-37 | Supported languages for MVP | P1 | A-11 | English first |
| OQ-41 | Build team model and budget ceiling | **P0** | A-16; S-08 | Founder to state a ceiling; doc 06 re-estimates |
| OQ-42 | Long-term durability commitments, subscription cessation, export and inheritance of data | P1 | S-04 §5.1 q9 | No "forever" promise; guaranteed export; a defined preservation tier |
| OQ-43 | Business model and pricing | P1 | S-06 §5.7; S-03 §9 | Research options; none approved |
| OQ-44 | Which community trends may be learned without leaking personal data? | P2 | S-04 §5.1 q10 | Editorial only in MVP (DR-021) |
| OQ-46 | Positioning test ("living legacy", "family wisdom archive", "ask your parent's memories", "copy of conscience") | P1 | S-04 §5.2 | Test in discovery interviews |
| OQ-47 | Is the amber/orange glow in the landing visuals part of the approved palette? | P2 | R6 C-23 | Treat as an accent candidate, not approved |
| OQ-49 | Trademark and domain availability for "Echo of Me" | P1 | S-04 §5.6 | Search before any public launch |
| OQ-50 | Legal entity, IP ownership and licensing between QI and Echo of Me | P1 | A-05; S-05 §1.6; S-06 §1.5 | Founder confirms |
| OQ-51 | Which third-party tools are approved to hold project material (e.g., Notion board for DR-036, slide generators)? | P1 | DR-031; DR-036 | None until vendor review; the Git repo + Claude Project are the default |
| OQ-52 | Where is the version-controlled documentation repository hosted? | P1 | A-19 | Private GitHub repository under the QI organisation |
| OQ-53 | Will the founder act as the first test author? | P2 | A-18 | Yes, recommended |
| OQ-56 | In June 2025 the first release was to feature **one of Feedback Loop, Memory Canvas or Echo Edit** (S-17). Which was chosen, if any, and does the founder want one differentiating module alongside MVP-1? | **P0** (affects 01D) | S-17; DR-049; C-33 | Keep S-09 focus (01–06) for MVP-1. If one is wanted, **Memory Canvas** is the lowest-risk candidate (no child data, no voice cloning) as an MVP-1.1 add-on after the faithfulness gate passes | Founder |
| OQ-57 | May Claude request read access to the founder's local Downloads/Desktop folders to search for the original report or ZIP? | P2 | R8 §7.2 | Optional; the ChatGPT conversation is the better path | Founder |

## 10. Research work packages

| ID | Work package | Feeds | Sources |
|---|---|---|---|
| RW-01 | Dated 2026 competitor refresh (HereAfter AI, StoryFile, YOV, Eternime, Replika, Lifenaut, Eter9, SafeBeyond, StoryWorth, Living Wisely, LifeChronicles, new entrants) | 02 | S-04 §5.2; S-05 §5.4 |
| RW-02 | Discovery interviews: 20–30 parents + adult recipients; grief contexts kept separate | 01D, 02 | S-04 §5.4 gate 0; S-06 §5.4 |
| RW-03 | Child development, non-clinical reasoning activities, age adaptation; adjacent products (LENA System, Thrive by Five) | Module 07 spec | S-05 §3.3, §5.4 |
| RW-04 | Guided autobiographical interviewing and values elicitation; adaptive prompts and decision trees | 05 spec, 04 | S-05 §5.4 |
| RW-05 | Retrieval grounding and faithfulness evaluation methods | 04 | S-05; S-06 §5.6 |
| RW-06 | Synthetic speech and posthumous likeness governance | 05, Module 09 | S-05 §5.4 |
| RW-07 | Video/music detection, transcription, rights-aware transformation | Module 09 | S-05 §5.4 |
| RW-08 | Bereavement- and grief-informed interaction design 🩺 | 02, 05 | S-05 §5.4 |
| RW-09 | Digital inheritance, archive integrity, provider portability | 03, 05 | S-05 §5.4 |
| RW-10 | POPIA, children's data, cross-border transfer, consumer protection, digital estates ⚖ | 05 | S-04 §5.3 |
| RW-11 | IP ownership, vendor contractual rights and confidentiality | 07 | S-05 §5.4 |
| RW-12 | TAM/SAM/SOM with explicit assumptions (none calculated historically) | Commercial pack | S-04 §5.2 |
