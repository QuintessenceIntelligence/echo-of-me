# Echo of Me | Vertical slice 1 test results (author consent & onboarding)

| Field | Value |
|---|---|
| Version | v1.0 |
| Run date | 16 November 2026, ~23:15 SAST |
| Build | commit after `e98fed7` (see git log) |
| Environment | Local only: Node 22, PostgreSQL 16.15, Next.js 16 production build, headless Chrome. **Not deployed anywhere.** |
| Result | **22/22 unit and database tests passed · 17/17 browser walkthrough steps passed · 0 automated accessibility violations (axe-core, WCAG 2.0–2.2 A/AA rules) on 7 screens** |

## 1. What was tested against the MVP acceptance criteria (01D §4)

| Criterion | Evidence | Status |
|---|---|---|
| **AC-01** Author creates a legacy, adds three recipients, records consents with text version and timestamp | Unit test "records each consent with its text version, text fingerprint and timestamp"; browser steps 3–4 | **Met for slice 1** |
| **AC-02** Adding a recipient grants no access until the author shares content | Unit test: accepted recipient querying raw SQL sees 0 rows in every legacy table; browser: recipient sees "Nothing has been shared with you yet" | **Met** (sharing itself arrives in slice 5) |
| **AC-08** (foundation) No cross-legacy access | `isolation.test.ts`: 7 operations on another family's legacy refused and audited; raw SQL as the app role reads 0 and writes 0 rows; no-session reads 0 rows; RLS cannot be switched off by the app role | **Foundation met**; full adversarial suite (incl. prompt manipulation) comes with slice 3 |
| **AC-13** (part) Audit log for access, sharing and consent changes, minimised payloads | Unit test confirms names/emails absent from audit detail; browser shows author-visible log incl. refused attempts by others | **Partially met** (answers/sources logging arrives with slice 3) |
| **AC-14** WCAG 2.2 AA (target) | axe-core automated scan: 0 violations on 7 screens | **Automated check only**; manual keyboard/screen-reader review still needed |

## 2. Safeguards verified (negative cases)
- No legacy can be created before the two required consents. Consent to an outdated text version is rejected.
- Consent history, audit log and consent texts are append-only, even for the database owner.
- Withdrawing "share with recipients" cancels every pending invitation in the same transaction.
- Invitations need a confirmed second factor, the sharing consent, an adult recipient with email. Tokens are stored only as SHA-256 hashes, are single-use, expire after 14 days, are cancelled by re-inviting or revoking, and only work for the invited email address.
- Children can never be given an email, login or invitation (application check **and** database constraint).
- Mutation checks: removing the MFA check makes 1 test fail; weakening one RLS policy makes 3 tests fail. The tests detect real regressions.

## 3. Bugs found and fixed during testing
1. Error messages after a form inside a page section (`/legacy#recipients`) were placed after the `#` and never shown. Fixed in `app/actions.ts`.
2. Two pages were pre-rendered at build time although they depend on the signed-in person. Fixed by forcing per-request rendering everywhere.
3. A refused invitation acceptance would have rolled back its own audit record. Fixed by returning a status from the database function.

## 4. Known limitations (honest status)
- **Sign-in and MFA are simulated** (`AUTH_MODE=dev`). The second-factor *rule* is enforced; the factor itself is not real until an identity provider is approved (ADR-004).
- **Email is not sent.** The author copies the one-time link shown once on screen.
- **Consent texts are drafts, not legally reviewed** ⚖ (labelled in the UI and the database).
- Not yet built: legacy deletion/export (AC-12), account recovery, rate limiting, CSRF review beyond Next.js defaults, production hosting, backups, monitoring.
- Single legacy per author in the UI (the database supports several).

## 5. How to re-run
```bash
npm install
TEST_PG_URL="postgresql://postgres@localhost/postgres" npm test           # unit + database tests
DATABASE_URL=... npm run db:migrate && npm run build && npm start           # app (see .env.example)
python3 tests/e2e/walkthrough.py http://localhost:3000                      # browser walkthrough (needs Playwright + Chrome)
```
Raw outputs: `tests/results/e2e_walkthrough.json`, screenshots in `tests/results/screenshots/`.
