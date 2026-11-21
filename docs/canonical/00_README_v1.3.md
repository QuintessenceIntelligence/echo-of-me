# Echo of Me | 00 README: Canonical Knowledge Base

*Because your love deserves a voice beyond time.* · By Quintessence Intelligence

| Field | Value |
|---|---|
| Document ID | 00 |
| Version | v1.3 |
| Date | 17 November 2026 |
| Status | CANONICAL index. Supersedes v1.2 (index refreshed: R2 v1.5, R7 v1.4, `adr/`, `build/`, code repository). |
| Project phase | **Building.** Development authorised (DR-051). Slices 1–5, legacy deletion and guided prompts built and tested locally (updated 19 Nov 2026); code on GitHub. Start with `canonical/Echo_of_Me_Chat_Handoff_Current_State.md`. |

## 1. Start here
1. **Handoff** (`canonical/Echo_of_Me_Chat_Handoff_Current_State.md`): where everything is, what is next, what needs the founder.
2. **01A Product Vision & Charter**: mission, non-negotiable principles P-01–P-12, glossary.
3. **R2 Decision Register**: what is CONFIRMED vs awaiting approval; gates G1–G7.
4. **01C Module Register**: the authoritative 11-module catalogue (01–10 + 08A).
5. **01D MVP Boundary Recommendation**: MVP-1, exclusions, acceptance criteria AC-01–AC-14 and hypotheses.
6. **01B Master Product Handoff**: the consolidated history, research, data model (incl. provenance P1–P6, evidence E1–E3), flows and edge cases.
7. **ADRs and build evidence** (`canonical/adr/`, `canonical/build/`): technical decisions and test results per slice.
8. **R8 Original Research Recovery Register**: read before stating anything as "what the 2025 research found" (evidence grades HG-1 to HG-5).

## 2. Source-of-truth hierarchy
| Rank | Source | Rule |
|---|---|---|
| 1 | Founder governance: Project Instructions + Supplementary Governance (S-09 prevails) and approvals logged in R2 §6 | Overrides everything |
| 2 | **This canonical set** (00, 01A–01D, R1–R9, ADRs, build results, and later 02–07) | Working truth; must cite sources |
| 3 | Original 2025 documents (S-01 Scope & Brief, S-02 Full Dossier, S-17 Master Checklist) | Primary historical evidence (HG-1) |
| 4 | Secondary references (reconstructions): handoffs S-04 to S-07 and the **provisional** reconstructed research report S-03 | Retained unchanged and active. Historical claims graded HG-3/4/5 unless corroborated (R8). The original research report is missing (M-01; R8). |
| 5 | Visual references (landing images, QI logos) | Reference only; never requirements |

For **implementation status**, the tested code and test results in GitHub are the evidence; documents describe it but do not replace it.

When sources conflict, follow R6. If R6 does not cover the conflict, log a new `C-xx` entry rather than choosing silently.

## 3. Document inventory (latest versions)
| ID | Document | Version | Status |
|---|---|---|---|
| — | Chat Handoff: Current State | living | Read first |
| 00 | README (this file) | v1.3 | Canonical |
| 01A | Product Vision & Charter | v1.1 | Canonical |
| 01B | Consolidated Master Product Handoff | v1.1 | Canonical |
| 01C | Authoritative Module Register | v1.1 | Canonical (catalogue CONFIRMED; phasing PROPOSED) |
| 01D | MVP Boundary Recommendation | v1.1 | Gates decided CONFIRMED FOR MVP (DR-052); document text still labelled PROPOSED |
| R1 | Source Register | v1.1 | Living register |
| R2 | Decision Register | **v1.5** | Living register (v1.4 copy still in Project knowledge, superseded) |
| R3 | Assumption Register | v1.1 | Living register |
| R4 | Risk Register | v1.1 | Living register |
| R5 | Open Question Register (+ research work packages) | v1.1 | Living register |
| R6 | Reconciliation & Conflict Log | v1.1 | Canonical |
| R7 | Progress & Change Log | **v1.4** | Living log (v1.3 copy still in Project knowledge, superseded) |
| R8 | Original Research Recovery Register | v1.0 | Living register |
| R9 | Research Refresh Plan (RR-01…RR-05) | v1.0 | PROPOSED plan |
| ADR-001…005 | Foundation: client platform, backend, data platform, identity/MFA, isolation (+ v1.1 least-privilege amendment) | v1.1 | Accepted working defaults (`canonical/adr/`) |
| ADR-006 | Memory capture and provenance | v1.0 | Accepted (`canonical/adr/`) |
| ADR-007a | Provider-free grounded answers | v1.0 | Accepted |
| ADR-008 | Rehearsal answer rules (pin, suppress, answer it yourself) | v1.0 | Accepted |
| ADR-009 | Sharing with adult recipients, recipient access | v1.0 | Accepted |
| ADR-010 | Guided prompt library | v1.0 | Accepted |
| ADR-007 | AI provider | — | **Open (founder decision, DR-016)** |
| — | Slice 1 test results | v1.0 | `canonical/build/` |
| — | Slice 2 test results | v1.0 | `canonical/build/` |
| — | Slice 3a, slice 4, slice 5, module 05 & deletion test results; Evaluation Summary | v1.0 | `canonical/build/` |
| RR-01…05 | Research Refresh documents (dated, sourced) | — | Reserved |
| 02–07 | PRD, Architecture, AI Conscience, Security/Privacy, Build Plan, Playbook | — | **Reserved**; written incrementally as slices land (ADRs and test results feed 03, 04, 05) |
| M07–M10 | Module specs: Feedback Loop, Memory Canvas (+08A), Video Canvas, Timed & Milestone Messages | — | Reserved (post-MVP) |

## 4. Where things live
- **Application code (version-controlled master for code):** GitHub `QuintessenceIntelligence/echo-of-me` (private), branch `main`.
```text
echo-of-me/
├── app/              Next.js pages, server actions, route handlers (media, export)
├── src/domain/       business rules: consent, onboarding, vault, export, rehearsal, sharing, prompts, deletion, audit
├── src/server/       database contexts (RLS), sessions, migrations, blob storage, zip
├── db/migrations/    0001–0011 SQL incl. row-level security
├── db/seed/          consent texts v0.1-draft (not legally reviewed); guided prompts v0.1-draft
├── docs/adr/         ADR-001…010 (copies of the canonical ADRs)
└── tests/            vitest on real Postgres, eval/ answer evaluation sets, e2e/ browser walkthroughs, results/
```
- **Canonical documents:** Claude Project knowledge under `canonical/…` (what Claude reads each session). ADRs and test results are also committed in the code repository. *Correction to v1.2:* the docs-repository layout shown in v1.2 §4 was a plan; the registers and foundation documents are **not yet mirrored in Git** (open follow-up, A-19).
- **Dev database:** Supabase project `cvyoicwcsbxmhjuslixv` (eu-west-1, free plan, synthetic data only); see handoff §0.2.

## 5. Identifier scheme
| Prefix | Meaning | Register |
|---|---|---|
| S-xx / M-xx | Source present / missing artifact | R1 |
| C-xx | Conflict | R6 |
| DR-xxx | Decision | R2 |
| G1–G7 | Founder decision gate | R2 §3 |
| A-xx | Assumption | R3 |
| RK-xx | Risk | R4 |
| OQ-xx / RW-xx | Open question / research work package | R5 |
| P-xx | Charter principle | 01A §8 |
| AC-xx / H-x | MVP acceptance criterion / pilot hypothesis | 01D |
| P1–P6 / E1–E3 | Provenance / evidence class | 01B §4.3; implemented for sources in ADR-006 |
| ADR-xxx | Architecture decision record | `canonical/adr/`, repo `docs/adr/` |
| HG-1…HG-5, +RV | Historical evidence grade / requires current validation | R8 §2 |
| K-xx / Q-x | Known fact about the missing report / question its recovery would answer | R8 |
| RR-0x | Research Refresh document | R9 |
IDs are never reused. A retired item is marked SUPERSEDED or CLOSED, not deleted.

## 6. Versioning rules
- File names carry the version with dots: `_v1.0.md`, `_v1.1.md` (founder preference).
- **Minor** (v1.0 → v1.1): additions, clarifications, a newly logged approval. **Major** (v1.x → v2.0): structural change or a reversed CONFIRMED decision.
- Each controlled document has a header block (ID, version, date, status, supersedes).
- Every change gets a line in R7. Code changes get a Git commit; documents mirrored in the repository also get one: `docs(<ID>): <summary> [vX.Y]`.
- Founder-uploaded sources are never edited or deleted by Claude. Superseded Claude-authored copies are removed from Project knowledge only with founder agreement (precedent: 16 Nov 2026 22:44).
- Statuses follow S-09: CONFIRMED · CONFIRMED CONCEPT · PROVISIONAL · PROPOSED · UNRESOLVED · HISTORICAL (+ CONFIRMED FOR MVP, DR-052).

## 7. Recommended update to Project Instructions (founder action, still open)
The Project Instructions now point to the handoff and this README first, which resolves most of the v1.2 recommendation. Still recommended: rename the S-08 references to `02_…`–`07_…` build documents to include version suffixes (e.g. `02_Product_Requirements_Document_v1.0.md`).

## 8. Source disposition (founder directive DR-047)
**No source document is deleted, replaced, archived or declared superseded without explicit founder approval.** All sources (S-01 to S-17) remain active in Project knowledge, unchanged. S-03 is a **provisional secondary reference**, labelled as a reconstruction. Optional future moves are listed in R6 §6 for discussion only.
