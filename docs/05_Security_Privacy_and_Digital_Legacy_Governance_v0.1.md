# 05 | Security, Privacy and Digital Legacy Governance

| Field | Value |
|---|---|
| Document | 05 (required build document) |
| Version | **v0.1 DRAFT for legal and clinical review**: not legal advice, not a compliance claim |
| Date | 19 November 2026 |
| Author | Claude (session 4), from the code on `main` `6f31db3` and the decision register R2 v1.5 |
| Scope | Echo of Me MVP-1 as built (slices 1–6, ADR-001…013), plus the governance design for what is deliberately not built yet (posthumous release, minors, synthetic voice) |
| Read with | `03_Technical_Architecture_and_Engineering_v1.0.md` (how it is built), `01D_MVP_Boundary_Recommendation_v1.1.md` (what is in and out), R2 v1.5 (decisions), R4 (risks) |

**Markers.** ✅ built and tested (evidence named) · 🟡 designed or proposed, not built · ⛔ excluded from MVP-1 by a founder decision · ⚖ needs a qualified legal reviewer · ⚕ needs a clinical or safe-messaging reviewer. External facts are linked to their sources at the end; anything without a source is a design statement, not a legal statement.

---

## 1. Summary

**What protects people today (all on synthetic data only, DR-053):**
- Every family's data is separated **inside the database** (row-level security per legacy, forced on every table), not just in application code. Adversarial cross-family tests pass for every slice (0 successes).
- Nothing reaches a recipient unless the author **approved** it and **chose to share it with that person**; access is re-checked in the database on every read and ends the moment sharing, consent or membership ends.
- Answers **quote only** what the author approved and shared, cite it, or say nothing was recorded. No AI model generates text anywhere yet. The interface always says it is not the person; role-play requests and crisis messages are routed away from the archive.
- Consent is recorded per purpose against the **exact text** (SHA-256), is append-only, and can be withdrawn at any time with immediate effect.
- People can **export** (authors), **download their own data** (everyone), **leave** a legacy (recipients), **delete** a memory or a whole legacy, and **close** their account.
- Strict browser security policy, rate limits, least-privilege database login, second factor required for sensitive actions (simulated in development).

**What is not in place, and blocks any real personal data (§13):** real sign-in with a second factor; an Information Officer; operator agreements and a cross-border basis for the EU-hosted database; backups and a restore drill; malware scanning; a breach-response owner; legal review of the consent texts and of this document; clinical review of the safety wording.

**Decisions that keep risk low in MVP-1:** adults only, minors as records (DR-026, ⛔ child access); no posthumous activation (DR-032, ⛔); no voice cloning (DR-028, ⛔); no Feedback Loop child data (DR-029, ⛔); no fine-tuning and no cross-family use of content (DR-022, DR-021).

---

## 2. Roles and accountability

| Role | Who | Status |
|---|---|---|
| Responsible party (POPIA) | Quintessence Intelligence: the legal entity, its registration and IP ownership are **UNRESOLVED** (handoff §A) | ⚖ confirm the entity before any real data |
| Information Officer | Not appointed | ⚖ appoint and register before the pilot |
| Operators (processors) | Supabase (database; dev project in **eu-west-1, Ireland**), Vercel (hosting; nothing deployed) | ⚖ operator agreements (s 21) and transfer basis (s 72) needed; 🟡 |
| Author | Adult who creates and controls a legacy | ✅ |
| Recipient | **Adult** invited by email; sees only what is shared with them | ✅ (DR-026) |
| Child | Record only: no login, cannot be invited, nothing can be shared to them | ✅ enforced by a database constraint (DR-026) |
| Trusted contact | Record only; **no powers** in MVP-1 | ✅ (DR-042); powers designed in §10 🟡 |
| Platform administrator | No default access to content; no admin screens exist | ✅ by absence; ⚠ see insider risk in §11 |

---

## 3. Legal frame (primary jurisdiction assumed South Africa, DR-038)

This table maps POPIA topics to what the product does. It is a design aid for the legal reviewer, not an opinion.

| POPIA topic | What it says (sourced) | Product implication | Status |
|---|---|---|---|
| Who is protected | "Personal information" relates to an identifiable, **living**, natural person (and existing juristic persons) [S1][S2]. Commentators read this as POPIA not applying to a deceased person's own information, while confidentiality and the information of **living** people in those records still need protecting [S3]. | After an author dies, POPIA may no longer protect *their* information, but memories routinely name living children, partners and friends, which remain protected. Posthumous release therefore still needs consent, purpose and access controls, plus estate and contract law. | ⚖ L-01 |
| Consent and lawful basis (s 11) | Consent must be voluntary, specific and informed; the responsible party bears the burden of proof; it can be withdrawn [S4]. | Six consent purposes, each a versioned text with SHA-256; append-only events; withdrawal any time (§5). | ✅ texts are **v0.1 drafts** ⚖ L-02 |
| Special personal information (s 26–27) | Processing is prohibited unless an exception applies; categories include religion or belief, health, sex life, political persuasion, race or ethnic origin, criminal behaviour [S5]. | Life stories naturally contain these (faith, illness, family conflict). The author can mark an item **sensitive**; sharing a sensitive item needs an extra confirmation. Whether author consent is a sufficient gateway for *other people's* special information inside an author's memories is a legal question. | ✅ flag; ⚖ L-03 |
| Children (s 34–35) | Processing a child's personal information is prohibited unless an exception applies, for example **prior consent of a competent person** (usually a parent or guardian) [S6][S7]. | Children cannot have accounts (DR-026). But authors write about their children, so the archive **does** hold children's information, entered by a parent. Whether the author is always a competent person (divorced parents, step-parents, grandparents as authors) needs review. | ✅ no child accounts; ⚖ L-04 |
| Security safeguards (s 19) and operators (s 21) | Responsible parties must secure integrity and confidentiality and ensure operators do the same by written contract [S8]. | Controls in §6–§9. Operator agreements not signed. | 🟡 ⚖ L-05 |
| Security compromises (s 22) | Notify the Information Regulator and affected people as soon as reasonably possible where there are reasonable grounds to believe information was accessed or acquired by an unauthorised person [S9]. Since **1 April 2025** notifications must go through the Regulator's **eServices portal** [S10]; the Regulator's fact sheet says **low-risk compromises must also be reported** [S11]. | Breach runbook in §12. | 🟡 owner needed |
| Access and correction (s 23–25) | Data subjects may request access to, and correction or deletion of, their information [S12]. | Author export (zip with checksums); "Download my data" for everyone; editing creates new versions; deletion paths in §9. | ✅ |
| Cross-border transfer (s 72) | Transfer to a third party in a foreign country only on one of a closed list of grounds, such as adequate protection by law or binding agreement, or consent [S13][S14]. | The dev database is in Ireland. Synthetic data only until a basis is chosen, or a South African region is used. | ⚖ L-06 (DR-053 condition) |
| Automated decision-making (s 71) | Restricts decisions with legal or substantial effect based solely on automated processing [S12]. | Echo of Me makes no decisions about people; answers are quotations with citations. | ⚖ L-07 confirm not applicable |

**Other jurisdictions.** Users outside South Africa (for example EU residents, to whom the GDPR may apply) are out of scope for MVP-1 and the pilot. ⚖ L-08: decide whether to restrict sign-up to South African residents during the pilot.

---

## 4. Data inventory

| Data | Where | Who can read it | How it ends |
|---|---|---|---|
| Account (name, email, identity-provider subject) | `account` | The person | Anonymised on closure (ADR-013) |
| Consent events (purpose, document version and hash, time) | `consent_event` (append-only) | The person | **Kept**, linked to an opaque id (⚖ L-09 retention) |
| Activity log (actions, ids, codes; never content) | `audit_event` (append-only) | The actor; the legacy's author | **Kept** (⚖ L-09) |
| Legacy, recipients, trusted contacts | `legacy`, `recipient`, `trusted_contact` | Author | Legacy deletion (cascade) |
| Memories and values (all versions) | `memory_item`, `memory_version` | Author; recipients for approved, shared items only | Item or legacy deletion |
| Recordings and photos (byte-identical originals, SHA-256) | Blob storage + `media_asset` | Author; recipients of shared items | Media, item or legacy deletion (file removed after the database commit) |
| Transcripts and tags | `transcript*`, `memory_tag` | Author; recipients see approved transcripts of shared items | As above |
| Sharing grants | `share_grant` | Author | Stop sharing; consent withdrawal; recipient leaves; deletion |
| Author practice questions | `rehearsal_turn` | Author | "Clear history"; legacy deletion. Crisis messages are **never stored** (constraint) |
| Recipient questions and reports | `recipient_turn`, `answer_report` | Asker only (the author sees a report, and the question only if the reporter chose to include it) | Asker leaves or closes the account; legacy deletion |
| Answer rules (pin, suppress, own words) | `answer_rule` | Author | Remove rule; legacy deletion |
| Rate-limit counters | `rate_limit` (no application access) | Nobody through the app | Window expiry; account closure |
| Session | Signed, HTTP-only cookie (8 hours) | The browser | Sign-out; expiry; closed accounts refused |
| Pilot measures | Computed on demand, **aggregates only**, by a role that cannot read tables | Operator (founder) | Nothing new is stored (ADR-011); real-participant use needs approval ⚖ L-10 |

**Not collected:** location, device fingerprints, analytics or advertising trackers, contacts, payment data.

---

## 5. Consent (implemented, ADR-003)

| Purpose | Who gives it | Effect of withdrawal (immediate) |
|---|---|---|
| Terms of service; Privacy notice | Everyone | Needed to use the service |
| Storing your voice recordings | Author | New recording and upload stop; **existing recordings are kept** until the author deletes them (⚖ L-11 confirm) |
| AI processing (answers to questions, theme suggestions) | Author | Practice and recipient answers switch off; pending automatic suggestions are deleted |
| Sharing with recipients | Author | All pending invitations are cancelled **and every share is removed** (stricter than the v0.1 text, which mentions only invitations; ⚖ L-02 align) |
| Recipient terms | Recipient | Accepting an invitation requires it |

Each consent is recorded against the exact document version and its SHA-256; re-consent is requested when a text changes. Consent texts are labelled `draft_not_reviewed` in the database until a legal reviewer signs them off.

---

## 6. Access control (ADR-005, ADR-009, ADR-013)

- **Database-enforced isolation.** Every request runs as the role `echo_app` with the signed-in account set by `app.set_actor`, which refuses closed or unknown accounts. Row-level security is **forced** on every table. The hosted login (`echo_app_login`) can do nothing until it switches to that role.
- **Narrow cross-boundary checks** are SECURITY DEFINER functions with pinned search paths (membership, sharing, consent of the author). ⚠ To verify on Supabase that these behave as tested locally (handoff §0.8 item 1).
- **Recipient access** requires all of: an accepted adult membership, an active legacy, the author's current sharing consent, an approved item, an explicit share to that person, and (for sensitive items) the author's extra confirmation. Each read re-checks all of these.
- **Second factor** is required to invite, change sharing, delete an item or a legacy, export a legacy, download your own data and close an account. In development it is **simulated and labelled as such**; real TOTP comes with Supabase Auth (ADR-004) 🟡.
- **Invitations** are single-use, 256-bit random tokens stored only as hashes, valid 14 days, accepted only by an account with the invited email address, and cancelled when sharing consent is withdrawn.

Evidence: `tests/isolation.test.ts`, `tests/slice2-isolation.test.ts`, `tests/slice5-sharing.test.ts`, `tests/account-rights.test.ts`, `tests/hosting-safety.test.ts`.

---

## 7. Application and infrastructure security

| Control | Status |
|---|---|
| Strict nonce-based Content-Security-Policy; `frame-ancestors 'none'`; `form-action 'self'`; `object-src 'none'` | ✅ all browser walkthroughs pass under it |
| `Referrer-Policy: no-referrer`; `X-Content-Type-Options: nosniff`; `Permissions-Policy` (microphone only on this site; camera and location off); HSTS when hosted | ✅ |
| Same-origin check on file downloads (export, my data); server actions protected by the framework's origin checks | ✅ |
| Per-account rate limits in the database (questions, uploads, invitations, exports, reports) | ✅ ADR-012 |
| Uploads: type detected from the file's bytes (allow-list), size limits (25 MB audio, 10 MB images, 250 MB per legacy), files never executed or transformed, SHA-256 checked on every read | ✅ |
| Malware scanning of uploads | 🟡 not built |
| Development sign-in and local file storage refuse to run on a hosted deployment | ✅ `hosting-safety.test.ts` |
| Encryption in transit | ✅ HTTPS when hosted (HSTS); 🟡 nothing hosted yet |
| Encryption at rest | 🟡 provider-managed; **to verify against Supabase and Vercel documentation and record in the operator agreements** before claiming it to users |
| Secrets | No secrets in the repository; hosted secrets only as encrypted environment variables (DR-057). The `echo_app_login` password is not yet set. |
| Dependency and CI checks | CI workflow exists with **manual trigger only** (not yet run) |
| Backups and restore | 🟡 none on the free plan; synthetic data only until they exist |
| Logging | Activity log of who did what (ids and codes only, never content); refused attempts logged; first rate-limit refusal per window logged |

---

## 8. AI and answer safety (ADR-007a, ADR-008)

- **Provider-free today.** Answers are found by full-text search and returned as **verbatim quotes** with citations and an evidence label (E1 direct, E2 related, E3 not recorded). No text is generated in the author's voice. Choosing an AI provider (ADR-007) is a founder decision and will need a fresh privacy review: data sent, retention by the provider, training opt-out, region (⚖ L-12).
- **Only approved, citable sources** can ever be quoted (the `citable_source` view); drafts, machine transcripts not yet approved, and unshared items are invisible to answers.
- **Identity:** every answer surface says it is Echo of Me, an AI interface, not the person. Requests to *be* or role-play the person are declined with an explanation.
- **Crisis messages** (self-harm or suicide language) are answered with South African help lines and never searched or stored. ⚕ C-01: patterns and wording need clinical / safe-messaging review. Help-line numbers were checked on 17 Nov 2026 against several published listings (noted in `src/domain/safety.ts`) and must be re-verified before any pilot.
- **Author control:** pin an answer, hide an item for a question, or answer in their own words (DR-030).
- **Recipient reports** go to the author (not to Quintessence Intelligence staff), with the question included only if the recipient chooses.
- **Evaluation:** 100 synthetic questions incl. a held-out set; all safety gates green (0 fabricated attributions, 0 crisis or identity leaks into retrieval). Paraphrase recall is low (a known limit of lexical search), which errs towards "not recorded" rather than guessing.

---

## 9. Retention and deletion

| Action | Who | What happens | Evidence |
|---|---|---|---|
| Delete a recording or photo | Author | Row deleted, file removed | slice 2 tests |
| Delete a memory | Author (2nd factor) | All versions, media, transcripts, tags, shares, answer rules for it; files removed | slice 2 tests |
| Delete the whole legacy | Author (2nd factor + typed title) | Everything in the legacy, including recipients, invitations, practice questions, recipient questions and reports; files removed; recipients lose access at once. Consent history and activity log kept without content | `legacy-deletion.test.ts`, browser 6/6 |
| Leave a legacy | Recipient | Access ends; shares to them removed; their questions and reports there deleted; author sees "left" | `account-rights.test.ts`, browser 11/11 |
| Close an account | Anyone (2nd factor + typed email; authors must delete their legacy first) | Memberships left; questions deleted; name, email and identity link replaced; consent and activity history kept under an opaque id; session refused | `account-rights.test.ts` |
| Clear practice history | Author | Practice questions deleted | slice 3a tests |
| Withdraw a consent | Anyone | See §5 | slice 1, 5 tests |

**Open retention questions** ⚖ L-09: how long to keep anonymised consent and activity records; whether inactive legacies are ever removed (they are never removed automatically today); what happens to a legacy if the author stops paying or Quintessence Intelligence stops operating (continuity and escrow, historical open question); backup retention once backups exist (deleted data persists in backups until they expire, which must be disclosed).

---

## 10. Digital legacy governance

### 10.1 MVP-1 (built)
- **Living author only.** Everything is shared by the author, while alive, item by item (DR-032). There is no death-triggered or scheduled release.
- **Adult recipients only**; children are records (DR-026).
- **Trusted contacts are records** with no powers (DR-042).
- **The author can change their mind** at any time: unshare, unapprove (which hides the item from recipients until re-approved), delete, withdraw consent.

### 10.2 Posthumous release: designed, not live 🟡 ⛔ (G3, DR-032)
A future release must answer all of these before anything is activated. Proposed design for legal review:

1. **Author instructions while alive:** for each recipient, what is released after death and when (immediately, on a date, at a milestone age), recorded as a versioned, consented instruction the author can change.
2. **Reporting a death:** only a nominated trusted contact can start the process; the report never releases anything by itself.
3. **Verification:** documentary evidence (death certificate or equivalent) reviewed by a person, plus a **waiting period** during which the author's own account is notified and can cancel (protects against false or malicious reports).
4. **Release:** only what the author pre-authorised, to adults only, each access logged; recipients see clearly that the person has died and that the archive contains only their recorded words.
5. **Disputes and authority:** who may object (executor, other family), how release is paused, and how estate law and the author's will interact. ⚖ L-13.
6. **Revocation:** what happens if a trusted contact or recipient relationship changes (divorce, estrangement, abuse).
7. **Incapacity:** whether a living but incapacitated author's instructions can be acted on. ⚖ L-14.
8. **Children reaching 18:** whether a child record can become an invited adult recipient, and how their own consent is obtained then.

### 10.3 Grief-sensitive safeguarding (⚕)
- Never present the archive as the person, or answers as new messages from them (built: disclosures, identity screen, quotations only).
- Avoid nudges that encourage compulsive use after a death (no streaks, notifications or engagement targets; none exist).
- Give recipients easy ways to step back: leave a legacy (built), mute later 🟡.
- Crisis routing (built, ⚕ C-01); content warnings for items marked sensitive 🟡; bereavement-support signposting wording ⚕ C-02.

### 10.4 Sensitive future functions (⛔ until the gate is reopened)
Synthetic voice or likeness (DR-028, G6); Feedback Loop child data (DR-029, G7); Memory Canvas likeness generation (DR-055, needs likeness consent and moderation); child-facing experiences (DR-026, G2). Each needs its own privacy impact assessment and founder approval.

---

## 11. Threats and misuse

| Threat | Control | Status |
|---|---|---|
| Another family sees my data | Database-enforced isolation; adversarial tests per slice | ✅ |
| Account takeover | Second factor for sensitive actions; rate limits; session expiry | 🟡 real MFA pending (ADR-004) |
| Someone pressures the author into sharing (coercive control) | Sharing is per item and reversible; activity log visible to the author | 🟡 ⚖ L-15 consider a "private mode" and safety guidance |
| Malicious death report (future) | Verification and waiting period (§10.2) | 🟡 not built (nothing is released on death today) |
| Insider access (anyone with database console access can read content) | App never uses the service role; least-privilege runtime; dedicated company Supabase account with MFA (DR-058) | ⚠ residual: console access is not logged by the app. 🟡 decide on access policy, provider audit logs, and whether to encrypt media per legacy |
| Prompt injection via memory text | No language model in the loop; injection questions in the evaluation set | ✅ today; ⚖/🟡 re-test when ADR-007 adds a model |
| Impersonation, deepfakes | No synthesis (DR-028); originals preserved with checksums | ✅ |
| Scraping or bulk extraction by a recipient | Rate limits; recipients see only shared items | ✅ |
| Invitation link forwarded | Single-use; must be accepted by the invited email address; expires in 14 days | ✅ |
| Harmful or illegal content uploaded by an author | No moderation; content is private to the family | ⚖ L-16 acceptable-use terms and a takedown process |
| Malicious files | Byte-level type checks; files never executed or transformed | 🟡 malware scanning |
| Denial of service | Rate limits; size limits | 🟡 hosting-level limits when deployed |

---

## 12. Security compromise (breach) response: proposed runbook 🟡

1. **Detect and record** (time, what, who found it). Anyone on the team can raise it.
2. **Contain**: revoke credentials, disable the affected feature, preserve logs.
3. **Assess**: which people and which data; whether there are reasonable grounds to believe information was accessed or acquired without authorisation (the s 22 trigger [S9]).
4. **Notify** the Information Regulator through the **eServices portal** and the affected people **as soon as reasonably possible** [S9][S10]. There is no low-risk exemption [S11]. Commentators cite about 72 hours as the Regulator's expectation, which the Act itself does not fix [S15]; treat 72 hours as the internal target.
5. **Tell people plainly** what happened, what it means for them and what they can do; in a grief context, with care (⚕ C-02).
6. **Review** and record lessons in R4 and R7.

Owner: the Information Officer once appointed (⚖ L-05). Until then, no real personal data.

---

## 13. Go / no-go for any real personal data (pilot gate)

All must be true. Status today: **No-go** (synthetic data only, DR-053).

1. Responsible-party entity confirmed; Information Officer appointed and registered.
2. Consent texts, privacy notice and recipient terms reviewed by a qualified lawyer (L-02).
3. Operator agreements with hosting and database providers; cross-border basis or South African region (L-05, L-06).
4. Real sign-in with TOTP; development sign-in impossible in production (built for the latter).
5. Backups with a tested restore, and disclosed retention.
6. Malware scanning of uploads, or uploads limited to recordings made in the app.
7. Breach runbook owned and rehearsed once.
8. Clinical / safe-messaging review of crisis and bereavement wording (C-01, C-02).
9. Pilot research consent and approval for pilot measures (L-10).
10. Isolation and safety tests re-run on the hosted environment.

---

## 14. Review register

### ⚖ Legal (L)
| ID | Question |
|---|---|
| L-01 | POPIA and a deceased author's information; what other law (privacy, dignity, estate, contract) governs posthumous release |
| L-02 | Consent texts v0.1, privacy notice, recipient terms; align sharing-withdrawal wording with the stricter behaviour |
| L-03 | Special personal information about third parties inside an author's memories: lawful basis |
| L-04 | Children's information entered by an author: is the author always a competent person? |
| L-05 | Operator agreements (s 21); Information Officer; responsible-party entity |
| L-06 | Cross-border transfer basis for EU hosting (s 72), or South African hosting |
| L-07 | Confirm s 71 (automated decisions) does not apply |
| L-08 | Restrict the pilot to South African residents? GDPR exposure otherwise |
| L-09 | Retention of anonymised consent and activity records; backup retention; inactive legacies; service continuity |
| L-10 | Pilot research consent and use of aggregate measures (ADR-011) |
| L-11 | Keeping existing recordings after "Storing your voice recordings" consent is withdrawn |
| L-12 | AI provider terms (data use, retention, region) before ADR-007 |
| L-13 | Disputes, executors and wills in posthumous release |
| L-14 | Author incapacity |
| L-15 | Coercive-control safeguards |
| L-16 | Acceptable-use terms and takedown for harmful content |

### ⚕ Clinical / safe messaging (C)
| ID | Question |
|---|---|
| C-01 | Crisis patterns, response wording and help lines (`src/domain/safety.ts`) |
| C-02 | Bereavement-sensitive wording for recipients, reports, breach notices and (future) posthumous release |

---

## Sources (accessed 19 November 2026)
- [S1] Baker McKenzie, Global Data and Cyber Handbook, South Africa key definitions: https://resourcehub.bakermckenzie.com/en/resources/global-data-and-cyber-handbook/emea/south-africa/topics/key-definitions
- [S2] MJ Kotze Inc, POPIA definitions (quotes s 1): https://mjkinc.co.za/popia/definitions
- [S3] Juta, "Do privacy rights exist concerning the personal information of deceased persons?" (Issue 22, May 2023): https://cms.juta.co.za/documents/66/Issue_22_Do_Privacy_Rights_Exist_Concerning_The_Personal_Information_Of_Deceas_tzD1bOi.pdf
- [S4] Usercentrics, POPIA overview (consent, burden of proof, withdrawal): https://usercentrics.com/knowledge-hub/south-africa-popia-protection-of-personal-information-act-overview/
- [S5] Information Regulator, Guidance Note on the Processing of Special Personal Information (2021): https://inforegulator.org.za/wp-content/uploads/2020/07/InfoRegSA-GuidanceNote-Processing-SpecialPersonalInformation-20210628.pdf
- [S6] Information Regulator, Guidance Note on Processing of Personal Information of Children (2021), via Law Library: https://lawlibrary.org.za/akn/za/doc/guidance-note/inforegsa/2021-06-01/guidance-note-on-processing-of-personal-information-of-children/eng@2021-06-01/source
- [S7] Bird & Bird, Children in the Digital World, South Africa: https://childreninthedigitalworld.twobirds.com/home/south-africa
- [S8] Information Regulator knowledge base, Condition 7 Security safeguards (ss 19, 21, 22): https://inforegulator.org.za/knowledge-base/category/popia/chapter-3-conditions-for-lawful-processing/part-a-processing-of-personal-information-in-general/condition-7-security-safeguards/
- [S9] Moonstone, "Updated POPIA compliance: data breach reporting must be online" (s 22 summary): https://www.moonstone.co.za/updated-popia-compliance-data-breach-reporting-must-be-online/
- [S10] Covington Inside Privacy, Information Regulator announcement of eServices Portal reporting (7 April 2025): https://www.insideprivacy.com/?p=15505
- [S11] Information Regulator, Fact Sheet: Handling of Security Compromises (2025): https://inforegulator.org.za/?p=15851
- [S12] POPIA (Act 4 of 2013), table of contents incl. ss 23–25 and 71, as published by IRBA: https://www.irba.co.za/upload/POPIA.pdf
- [S13] IT-Online, section 72 and the five transfer conditions: https://it-online.co.za/?p=119965
- [S14] ENS via Mondaq, "Transferring personal information outside of South Africa: POPIA and Schrems II" (2020): https://www.mondaq.com/southafrica/data-protection/973350/transferring-personal-information-outside-of-south-africa-popia-and-the-implications-of-schrems-ii
- [S15] MJ Kotze Inc, POPIA for tech companies (72-hour guideline vs statutory wording): https://mjkinc.co.za/software-technology-law/popia-for-tech-companies

Secondary commentary (S2, S3, S9, S13, S15) should be checked against the Act and Regulator publications by the legal reviewer.
