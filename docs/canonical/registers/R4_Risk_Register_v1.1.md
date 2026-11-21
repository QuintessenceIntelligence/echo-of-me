# Echo of Me | R4 Risk Register

| Field | Value |
|---|---|
| Document ID | R4 |
| Version | v1.1 |
| Date | 16 November 2026 |
| Status | CANONICAL (living register) |
| Scale | Likelihood (L) and Impact (I): 1 Low · 2 Medium · 3 High. Score = L × I. **≥6 = priority.** |

Mitigations listed are **PROPOSED** controls. None is implemented, because no build exists. Items marked ⚖ need qualified legal review; items marked 🩺 need clinical or child-development review (per S-08).

| ID | Risk | Category | L | I | Score | Proposed mitigation | Owner | Sources | Spec home |
|---|---|---|---|---|---|---|---|---|---|
| RK-01 | **AI fabricates memories or attributes beliefs the author never expressed** | AI truthfulness | 3 | 3 | **9** | Retrieval-only grounding; P/E taxonomy; mandatory citations; abstention on E3; faithfulness eval suite; author rehearsal with pin/suppress | AI lead | S-03 §8; S-04 §2.3; S-06 §2.4 | 04 |
| RK-02 | **Cross-family leakage or wrong-recipient retrieval** | Privacy/security | 2 | 3 | **6** | Tenant isolation per legacy; access filtering *before* retrieval; row-level security; adversarial access tests with a hard gate of 0 failures | Engineering | S-04 §4.3; S-06 §4.12 | 03, 05 |
| RK-03 | Emotional dependency, grief harm, or recipients treating the AI as the living parent 🩺 | Wellbeing | 2 | 3 | **6** | Persistent AI disclosure; no "alive" framing; grief-informed copy; optional usage pacing; signposting to human support; no engagement-maximising metrics | Product | S-03 §8; S-04 §2.3 | 05 |
| RK-04 | Premature or unauthorised posthumous release (false death report, coercion, disputes) ⚖ | Governance | 2 | 3 | **6** | No live posthumous release in MVP (DR-032); multi-party verification state machine; waiting period; audit; reversible suspension | Governance | S-04 §4.6; S-06 §4.10 | 05 |
| RK-05 | Child safeguarding failure (minor reaches unsuitable content, unsupervised access) ⚖🩺 | Child safety | 2 | 3 | **6** | Adult-only MVP (DR-026); age policy enforced in the application, not just the prompt; guardian design before minors | Governance | S-05; S-06 §4.9 | 05 |
| RK-06 | Covert or inappropriate psychological profiling of children through the Feedback Loop 🩺⚖ | Child safety/ethics | 2 | 3 | **6** | Post-MVP only (DR-029); non-diagnostic, low-confidence observations; no stable trait labels; child-visible correction/deletion; minimum retention; ethics review | Product | S-05 §2.6, §4.5; S-09 | Module spec 07 |
| RK-07 | Synthetic voice or likeness misused for impersonation or deepfakes, including after death ⚖ | Misuse | 2 | 3 | **6** | No cloning in MVP (DR-028); later: verified opt-in, watermark/label, generation restricted to authorised flows, posthumous-use rules | Product/Legal | S-04; S-05 §4.7; S-06 §2.3 | 05, 09 spec |
| RK-08 | Account takeover or coercive access to an author's or recipient's account | Security | 2 | 3 | **6** | MFA; step-up auth at release and export; device/session review; recovery with identity proofing | Engineering | S-04 §5.3 | 03, 05 |
| RK-09 | Prompt injection through uploaded documents or recipient questions | Security/AI | 3 | 2 | **6** | Policy enforced outside the model; treat content as data; output validation; red-team tests | AI lead | S-04 §4.6 | 04 |
| RK-10 | Non-compliance with POPIA (special personal information, children's data, cross-border transfer), consumer protection, or digital-estate law ⚖ | Legal | 2 | 3 | **6** | Legal review before pilot; PIA; DPAs; consent records; Information Officer registration (if applicable) | Founder/Legal | S-04 §5.3; S-05 §4.9; S-06 §4.12 | 05 |
| RK-11 | Copyright, music-licensing, platform ToS or character-IP infringement (Video Canvas, playful imagery such as "Superman") ⚖ | IP | 2 | 2 | 4 | Post-MVP; licensed music library; reference-only URLs; no third-party IP characters without a licence; rights record per asset | Product/Legal | S-05 §2.7.1, §2.8 | Module specs 08A, 09 |
| RK-12 | Long-term continuity failure: AI vendor deprecation, insolvency, payment lapse, shutdown | Continuity | 2 | 3 | **6** | Model-independent canonical store; open export formats; continuity/escrow plan; preservation pricing model | Founder/Eng | S-03 §8; S-04 §4.6; S-06 §5.3 | 03, 06 |
| RK-13 | Authors do not capture enough material, so the product feels empty (A-01 fails) | Product/market | 3 | 3 | **9** | Discovery before build; small-step prompts; reminders; capture metrics as a go/no-go gate | Founder | S-04 §3.2 | 02, 06 |
| RK-14 | Family disputes, guardianship conflicts, third-party privacy or defamatory content in memories ⚖ | Governance | 2 | 2 | 4 | Item-level visibility; third-party flagging; dispute workflow with human review; suspension state | Governance | S-04 §4.6; S-06 §4.13 | 05 |
| RK-15 | Changed beliefs or contradictions are flattened into a false single "truth" | AI truthfulness | 2 | 2 | 4 | Versioning and dated statements; surface conflicts; prefer the most recent statement with history disclosed | AI lead | S-03 §8; S-04 §4.6; S-06 §4.13 | 04 |
| RK-16 | Transcription errors become attributed "facts" | AI truthfulness | 2 | 2 | 4 | Transcripts unapproved until author review; original audio always retained and playable | AI lead | S-06 §4.6 | 04 |
| RK-17 | **Marketing or landing copy overpromises** ("think and speak like you", "preserve it. Safely.", "control everything", privacy guarantees, "100 families") | Trust/legal | 3 | 2 | **6** | Copy review against charter P-01–P-12 before any publication; claims register; legal review of privacy claims | Founder | S-04 §2.4; S-10/S-11; R6 §5 | 01A |
| RK-18 | Scope creep: pressure to include modules 07–10 or Tier 3 persona in MVP | Delivery | 3 | 2 | **6** | 01D boundary with explicit exclusions; change control through R2 | Founder | S-09; S-05 §5.3 | 01D |
| RK-19 | Confidential IP leaks through third-party AI or presentation tools (e.g., SlidesGPT) | Confidentiality | 2 | 2 | 4 | DR-031 rule; vendor review checklist; founder approval before sharing | Founder | S-05 §2.9 | 07 |
| RK-20 | Historical budget and schedule under-estimate true cost (legal, security testing, accessibility, insurance, support, long-term custody excluded) | Financial | 3 | 2 | **6** | First-principles re-estimate with contingency (doc 06) | Founder | S-04 §2.5; S-08 | 06 |
| RK-21 | Market is not empty; differentiation unproven; competitors may already offer source-grounded features | Market | 2 | 2 | 4 | Dated competitor refresh; positioning tests; interview evidence | Founder | S-04 §3.2; A-08 | 02 |
| RK-22 | Documentation drift: reconstructions mistaken for originals; missing original research report (M-01) | Knowledge mgmt | 2 | 2 | 4 | R1 authority ranking; R8 evidence grades; S-03 labelled provisional; recover M-01 (R8 §7) | Claude/Founder | R1; R6; R8 | 00 |
| RK-23 | Sensitive disclosures in content (abuse, medical secrets, criminal matters, ex-partners) surface to the wrong recipient ⚖🩺 | Privacy/safety | 2 | 3 | **6** | Sensitivity tagging; default-restricted visibility for sensitive classes; author confirmation; recipient-specific policy | Governance | S-04 §4.6 | 05 |
| RK-24 | Insider or administrator access to private family content | Security | 1 | 3 | 3 | Least privilege; no default content access; break-glass with audit; encryption | Engineering | S-04 §4.3; S-06 §1.4 | 03, 05 |
| RK-25 | Recipient in crisis (self-harm, abuse) receives an AI answer instead of being directed to human help 🩺 | Safety | 2 | 3 | **6** | Crisis classifier and policy outside the model; safe-messaging responses; region-appropriate resources; no "parent voice" in crisis replies | AI lead | S-04 §4.5; S-06 §4.13 | 04, 05 |
| RK-26 | Trademark or domain conflict on "Echo of Me" | Brand/legal | 2 | 2 | 4 | Trademark and domain search before public launch | Founder | S-04 §5.6 | — |
| RK-27 | **Retrospective reframing:** the 2026 reconstructions present current governance ideas (truthful AI, RAG, evidence classes, "not consciousness") as 2025 history, which could mislead investors, partners or future decisions about what was originally researched or intended | Knowledge mgmt / trust | 2 | 2 | 4 | HG grades on historical claims; the original 2025 wording is kept alongside the 2026 policy (R8 §4, C-36); no "our 2025 research found" claims without HG-1 | Claude | R8 | 00, R8 |

## Top priorities (score ≥ 6)
RK-01, RK-13 (9); RK-02, RK-03, RK-04, RK-05, RK-06, RK-07, RK-08, RK-09, RK-10, RK-12, RK-17, RK-18, RK-20, RK-23, RK-25 (6).
