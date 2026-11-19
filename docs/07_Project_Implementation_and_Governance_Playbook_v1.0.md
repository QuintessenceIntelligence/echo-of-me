# 07 | Project Implementation and Governance Playbook

| Field | Value |
|---|---|
| Document | 07 (required build document) |
| Version | v1.0 |
| Date | 19 November 2026 |
| Status | Describes how the project has actually been run in sessions 1–4, written down so any future session (or person) works the same way. Rules marked **[founder]** come from founder instructions or decisions; the rest are working practice and can be changed by the founder. |

---

## 1. Where the truth lives
| Rank | What | Where | Used for |
|---|---|---|---|
| 1 | Founder governance and recorded approvals | Project instructions; R2 §6 | Overrides everything |
| 2 | Canonical documents | Claude Project `canonical/` (handoff, 00, 01A–01D, R1–R9, docs 03/05/…, ADRs, build results, runbooks) | Product truth; what each session reads |
| 3 | Code and its tests | GitHub `QuintessenceIntelligence/echo-of-me`, branch `main` | **Implementation truth**: a feature exists only if its code and passing tests are on `main` |
| 4 | Historical sources | S-01, S-02, S-17 (originals); S-03…S-16 (secondary, unchanged) | Evidence, never silently superseded **[founder, DR-047]** |

**Start every session** with `canonical/Echo_of_Me_Chat_Handoff_Current_State.md`, then check GitHub `main` against the commit it names.

## 2. Repository layout
```text
app/            pages, server actions, route handlers: thin adapters, no business rules
src/domain/     business rules: validation (zod), ownership/consent/second-factor checks, audit
src/server/     database contexts (withActor, RLS), sessions and sign-in, storage, migrations
db/migrations/  NNNN_name.sql, forward-only; db/seed/ versioned texts
docs/           ADRs, numbered build documents, operations runbooks (copies of canonical)
tests/          vitest (real Postgres), eval/, e2e/ (Playwright + axe), results/
proxy.ts        per-request CSP; sign-in token refresh
```

## 3. Git workflow
- One branch per piece of work (`slice-5`, `account-rights`, `auth-supabase`). **Push after every meaningful step** so nothing is lost if a session ends.
- `main` moves only by **fast-forward** after the definition of done (§4) is met. No force-push, no rewriting history on `main` **[founder: destructive actions need approval]**.
- Commit messages: `type(scope): summary` (feat, fix, docs, chore, test), a short body saying what was verified, and the session attribution lines.
- Pull requests are optional while one person reviews; the founder can require them at any time.
- CI runs on manual trigger only until the founder enables it (it uses GitHub Actions minutes; DR-054).

## 4. Definition of done (per slice or feature)
1. Domain and database tests pass on real PostgreSQL, **including refusal cases** (wrong family, missing consent, missing second factor, bad input).
2. Adversarial isolation: the feature is attacked as another family, as a recipient and with raw SQL as the application role; **0 successes**.
3. A browser walkthrough of the real pages passes, with **0 automated accessibility violations** (axe, WCAG 2.0–2.2 A/AA), under the strict CSP.
4. For security-critical rules, a deliberate breakage (mutation) makes a test fail; if that cannot be run, say so in the results.
5. An ADR (or ADR update) explains the decision, its limits and what is not proven.
6. The handoff, R7 and test evidence are updated; code pushed; `main` fast-forwarded.
7. Anything tested only against a stand-in (emulator, fake provider) is labelled as such everywhere it is mentioned **[founder: never present simulated features as working]**.

## 5. Code standards
- **TypeScript strict.** Domain functions validate input, then check ownership, consent and second factor **inside** the row-level-security transaction, then write an audit event; refusals are audited separately.
- **Database first for safety:** every table has row-level security **forced**; the app connects as a least-privilege login; SECURITY DEFINER functions are few, narrow, with pinned `search_path`, and revoked from Supabase's API roles.
- **Refuse by default.** "Not found" for anything not yours; never reveal another family's data in errors.
- **Privacy in logs:** identifiers and codes only, never names, emails or memory content.
- **Originals are immutable:** append-only versions; media checked against SHA-256 on every read.
- **Browser:** no inline scripts or style attributes (strict CSP); plain-language messages; keyboard and screen-reader friendly.
- **Dependencies:** few, well-known, licence checked; added only with a reason in the commit or ADR.

## 6. Database migrations
- Numbered, forward-only files; an applied migration is never edited. Fixes are new migrations.
- Each migration revokes Supabase API roles (`anon`, `authenticated`, `service_role`) from new objects.
- Applied to the Supabase project only through the connector, after the founder switches it to the Echo of Me organisation **[founder: do not switch the connector without asking]**.

## 7. Testing
| Layer | Command / place |
|---|---|
| Unit + database + isolation | `npm test` (fresh database per file) |
| Answer quality | `tests/evaluation.test.ts` with `tests/eval/*.json` (incl. a held-out set) |
| Browser + accessibility | `python3 tests/e2e/walkthrough*.py` |
| Stand-ins | `tests/fake-gotrue.ts` (identity provider), moto (S3): behaviour of the app only |
| Evidence | `tests/results/` in the repo; summaries in `canonical/build/` and ADRs |

## 8. Environments and deployment
- **Local:** full stack, synthetic data.
- **Supabase dev project** (eu-west-1, free plan): synthetic data only **[DR-053]**.
- **Vercel** (Hobby, non-commercial): preview deployments only, Vercel Authentication on **[DR-056]**. Steps: `canonical/Hosted_Preview_Runbook_v1.0.md`.
- **Rollback:** redeploy the previous preview, or revert the commit on `main`; database changes roll forward with a compensating migration.

## 9. Secrets
- Never in the repository, never in chat, never in documents. Only in the hosting provider's encrypted environment variables and the founder's password manager.
- Claude never needs to see a secret value; steps that create one are done by the founder (runbook).
- Rotate any secret that may have been exposed; record the rotation (not the value) in R7.

## 10. Documents and versions
- File names carry dotted versions: `_v1.1.md` **[founder preference]**. A material change makes a new version file; older versions stay until the founder removes them.
- Decision labels: CONFIRMED, CONFIRMED CONCEPT, PROVISIONAL, PROPOSED, UNRESOLVED, HISTORICAL **[founder]**. A recommendation is never presented as a decision.
- Review markers: ⚖ legal, ⚕ clinical / safe messaging. External facts carry a dated source; unsourced facts are marked unverified.
- The 11-module catalogue (01–10 and 08A) is preserved; nothing is removed or merged away **[founder]**.

### ADR template
```markdown
# ADR-NNN: Title
| Field | Value |
|---|---|
| Status | ACCEPTED / PROPOSED (who decided, under which DR) |
| Date | |
| Code | files |
| Tests | files, counts, what is NOT proven |
## Context
## Decision
## Limits and follow-ups
## Alternatives considered
## Sources (dated)
```

### Change-log row (R7)
`| date | docs changed | what changed and what was verified | by | approval (DR or founder date) |`

## 11. Claude session rules
1. Read the handoff first; confirm GitHub `main` matches it.
2. When working while the founder is away: schedule a follow-up message in the chat, commit and push at each checkpoint, update the handoff after each one, and keep going with safe local work.
3. **Stop and ask** only for: spending (authority R0, DR-054), new vendors, credentials or sign-ins, switching the Supabase connector, destructive actions (deleting databases, overwriting production configuration, force-pushing), confidential data to third parties, and sensitive functions (minors, posthumous release, synthetic voice) **[founder]**.
4. Synthetic data only; never change the founder's other projects (for example Founders at Work).
5. If an automated safety system blocks an action, do not work around it; record it.
6. Report honestly: what was verified, against what, and what was not.
7. End with a short delivery summary and a list of what needs the founder.
