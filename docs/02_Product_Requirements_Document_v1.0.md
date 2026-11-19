# 02 | Product Requirements Document (MVP-1 "Governed Living Legacy")

| Field | Value |
|---|---|
| Document | 02 (required build document) |
| Version | v1.0 |
| Date | 19 November 2026 |
| Status | Consolidates 01D (MVP boundary, gates decided CONFIRMED FOR MVP by DR-052) with what has been built and tested. Requirements marked **PROPOSED** still need founder approval; built status is backed by tests in the code repository. |
| Read with | 01A (charter and principles), 01C (11-module catalogue), 01D (boundary, AC-01…14, H1…H8), docs 03–07 |

**Product in one sentence.** A living parent captures and approves memories and values by text and voice; rehearses how Echo of Me answers future questions, with every answer quoted, cited and willing to say "not recorded"; and shares chosen items with a few adult loved ones, under consent and permissions they can see and change. *Because your love deserves a voice beyond time.*

---

## 1. People
| Persona | Who | In MVP-1 |
|---|---|---|
| **Author** | A parent (or other adult) preserving their own memories, values and voice for people they love | Primary user |
| **Adult recipient** | An adult the author invites (for example a grown child) | Reads what is shared; asks questions; reports answers |
| **Child** | A minor in the family | **Record only**: no account, no access (DR-026) |
| **Trusted contact** | Someone the author names for the future | **Record only**, no powers (DR-042) |
| **Operator** | Quintessence Intelligence | No access to content; aggregate pilot numbers only (ADR-011) |

## 2. Jobs to be done
- *Author:* "Help me put down what matters before it is lost, in my own words and voice, without having to write a book." · "Let me see how my words would answer my children's questions, and correct it." · "Let me decide who sees what, and change my mind." · "Never let it pretend to be me or say things I did not say."
- *Adult recipient:* "Let me hear and read what they actually said, and ask about it, knowing what is their words and what is not." · "Let me step away if it becomes too much."

## 3. Core journeys (all built)
1. **Start:** sign in → agree to the consents (each shown with its version) → create the legacy → add family (children as records) → finish setup.
2. **Capture:** write a memory or value, record in the browser or upload (originals kept exactly), or answer a guided prompt; tag; mark sensitive; approve.
3. **Practise:** ask questions as a loved one might; see quotes with evidence labels or "not recorded"; pin, hide or answer it yourself; see gaps as new prompts.
4. **Share:** confirm the second sign-in step → invite an adult by email (one-time link) → share approved items one by one (sensitive items need an extra confirmation).
5. **Recipient:** accept the invitation → read and listen to shared items → ask questions (private) → report an answer to the author → leave at any time.
6. **Control:** activity log; withdraw any consent (immediate effect); export everything; delete an item or the whole legacy; download your own data; close your account.

## 4. Functional requirements by module (status)
| Module | Requirement | Status |
|---|---|---|
| 01 Profiles | Account with second factor; legacy profile; recipients (children as records); trusted contact (record); versioned purpose-specific consents; invitations | ✅ built (real second factor built against a stand-in, ADR-015) |
| 02 Vault | Text, browser recording, upload, photos; originals byte-identical; versions; transcripts with author approval; tags suggested → approved; sensitivity; audience intent; export | ✅ built; machine transcription awaits ADR-007 |
| 03 AI Conscience | Policy screens → retrieval over approved, permitted items → evidence class → quotes with citations → abstention; crisis policy; evaluation harness | ✅ built without a model (ADR-007a); generated answers PROPOSED (doc 04 §10) |
| 04 Interaction | Author rehearsal with pin / suppress / own words; adult-recipient Q&A with source cards, original audio, reports | ✅ built |
| 05 Prompts | Editorial prompt set, follow-ups, gap prompts | ✅ built; 35 draft prompts await editorial review |
| 06 Dashboard & safeguards | Approval; per-item sharing; consent management with propagation; activity log; deletion; export; report queue; rate limits; account rights | ✅ built |
| 07–10, 08A | Feedback Loop, Memory Canvas (+ playful identity images), Video Canvas / The Echo Edit, Timed & Milestone Messages | ⛔ not in MVP-1; preserved on the roadmap (01C) |

## 5. Acceptance criteria (from 01D) and evidence
| # | Criterion | Status | Evidence |
|---|---|---|---|
| AC-01 | Create a legacy, add three recipients, record consents with version and time | ✅ | slice 1 tests and walkthrough |
| AC-02 | Adding a recipient grants no access until something is shared | ✅ | `slice5-sharing.test.ts` |
| AC-03 | Audio retrievable byte-identical after transcription, editing and export | ✅ | slice 2 tests; 7.2 MB upload walkthrough |
| AC-04 | Machine transcripts and suggested tags never cited until approved | ✅ | `citable_source`; evaluation leakage 0 |
| AC-05 | Edits and deletions reflected in answers within ≤ 5 min | ✅ immediate (next question) | slice 3a/5 tests |
| AC-06 | Exactly one evidence class; citations for E1/E2; E3 attributes nothing | ✅ | evaluation sets |
| AC-07 | Out-of-corpus questions → E3 with adjacent memories | ✅ (100 % on both sets) | Evaluation Summary |
| AC-08 | No access to unshared or other families' items, including by manipulation: 0 failures | ✅ locally; 🟡 re-run when hosted | isolation suites |
| AC-09 | Persistent AI disclosure, including when asked "are you my parent?" | ✅ | identity screen; walkthroughs |
| AC-10 | Crisis questions → safe-messaging response, no "parent voice" | ✅; ⚕ wording review | safety tests |
| AC-11 | Pin, correct, suppress; pinned answers served as E1 with the date | ✅ | slice 4 |
| AC-12 | Export originals and metadata in open formats; delete the legacy everywhere | ✅ | export and deletion tests |
| AC-13 | Audit of access, sharing, consent and answers (source ids), minimised | ✅ | activity log tests |
| AC-14 | Core flows meet WCAG 2.2 AA | 🟡 automated checks: 0 axe violations on every main screen; skip link; every Tab stop on key pages has a visible focus indicator; sign-in to legacy creation works keyboard-only. Testing with assistive-technology users still needed | axe in all walkthroughs; `walkthrough_keyboard.py` |

## 6. Non-functional requirements
| Area | Requirement | Status |
|---|---|---|
| Isolation | Families separated by database-enforced rules; adversarial tests 0 successes | ✅ |
| Privacy | Minimised logs; no trackers; consent with exact text; data rights (doc 05) | ✅; ⚖ review |
| Security | Strict CSP; least-privilege database login; second factor for sensitive actions; rate limits; signed sessions; tokens never exposed to scripts | ✅ |
| Integrity | Originals immutable, SHA-256 checked on every read | ✅ |
| Accessibility | WCAG 2.2 AA target (AC-14) | 🟡 as above |
| Performance (PROPOSED targets) | Page responses < 1 s and answers < 2 s at pilot scale; uploads up to 25 MB on ordinary connections | Not yet measured on hosting |
| Availability (pilot, PROPOSED) | Best effort; daily backups; restore tested before real data | 🟡 needs paid plan (doc 06) |
| Data location | Primary jurisdiction South Africa (DR-038); hosting region and transfer basis decided before real data | ⚖ L-06 |
| Devices | Current desktop and mobile browsers; responsive web (DR-027) | ✅ web; native apps out of scope |
| Language and tone | Plain English, warm and calm, no sensational claims | ✅; copy to be reviewed before publishing |

## 7. Out of scope for MVP-1 (kept on the roadmap)
Children's direct use; posthumous or death-triggered release; synthetic voice, avatars, video persona; fine-tuning on a person's data; Feedback Loop; Memory Canvas and playful identity images; Video Canvas / The Echo Edit; Timed & Milestone Messages execution; community trend mining; video capture; contributor layer; native apps; payments; other languages (01D §3).

## 8. Open requirement decisions (founder)
1. Pilot thresholds H1–H8 (OQ-15, PROPOSED in 01D §5).
2. AI provider or stay provider-free (ADR-007; doc 04 §11).
3. Email provider for invitations (doc 06 §3).
4. Whether a differentiating module joins early (OQ-56; DR-055 PROVISIONAL: Memory Canvas).
5. Retention periods and other legal items (doc 05 §14).

## 9. Risks
See R4 Risk Register and doc 05 §11. The product-level risks that matter most for MVP-1: misattribution (mitigated by quoting only and abstention; measured by H3), leakage between families (hard gate H5), grief-related harm (crisis routing, disclosures, easy exit; ⚕ review), low capture (H1/H2; guided prompts and gaps), and low usefulness for paraphrased questions without an AI provider (doc 04).
