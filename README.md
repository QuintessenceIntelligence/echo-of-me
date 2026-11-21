# Echo of Me: application

*Because your love deserves a voice beyond time.* · By Quintessence Intelligence

**Status: pre-release.** MVP modules 01–06 are built and tested locally on synthetic data. Real sign-in (Supabase Auth with an authenticator-app second step) and hosted media storage are built and tested against local stand-ins, **not yet against the real Supabase project**. Nothing is deployed. Do not store real personal material (doc 05 §13: go/no-go is currently **no-go**).

Product source of truth: `docs/canonical/` in this repository (mirrored from the Echo of Me Claude Project on 21 Nov 2026; handoff first, then 00 README, R2 decisions, 01D MVP boundary). Working rules for Claude Code: `CLAUDE.md`. Architecture: `docs/03_Technical_Architecture_and_Engineering_v1.2.md` and `docs/adr/`. Security, privacy and governance: `docs/05_…_v0.1.md`. Hosted preview: `docs/operations/Hosted_Preview_Runbook_v1.0.md`. Latest test evidence: `tests/results/`.

## What is built
| Area | Status |
|---|---|
| 1 Author consent and onboarding | Built, tested (ADR-001…005) |
| 2 Memory capture and provenance | Built, tested (ADR-006) |
| 3 Grounded answers without an AI model | Built, tested (ADR-007a); AI composer awaits ADR-007 (founder decision) |
| 4 Author practice: pin, suppress, answer it yourself | Built, tested (ADR-008) |
| 5 Sharing with adult recipients; recipient questions and reports | Built, tested (ADR-009). Posthumous or milestone release is not in the MVP (DR-032) |
| Guided prompt library (module 05) | Built, tested (ADR-010); 35 draft prompts awaiting editorial review |
| Legacy deletion and export | Built, tested |
| 6 Pilot measures (aggregates only) | Built, tested (ADR-011); real-participant use needs approval ⚖ |
| Hardening: strict CSP, per-account rate limits | Built, tested (ADR-012) |
| Account rights: your account, download your data, leave, close | Built, tested (ADR-013) |
| Hosted media storage (Supabase Storage via S3) | Built, tested against an S3 emulator (ADR-014) |
| Real sign-in: Supabase Auth, TOTP, password reset | Built, tested against a stand-in provider (ADR-015) |

## Layout
```text
app/                 Next.js pages, server actions, route handlers (thin adapters)
src/domain/          business rules and policy checks
src/server/          database contexts (RLS), sessions and sign-in, JWT checks, migrations, blob storage, zip
db/migrations/       0001–0014, ordered SQL incl. row-level security
db/seed/             consent texts and guided prompts (v0.1 drafts, not reviewed)
docs/                ADRs, docs 03 and 05, operations runbooks
proxy.ts             per-request Content-Security-Policy; refreshes sign-in tokens
tests/               vitest on real Postgres; eval/ answer sets; e2e/ browser walkthroughs; results/
```

## Run locally
1. Postgres 16+ running. Copy `.env.example` to `.env.local` and fill it in.
2. `npm install && npm run db:migrate`
3. `npm run dev` → http://localhost:3000 (development sign-in with a **simulated** second factor; media under `STORAGE_DIR`).

## Tests
- `TEST_PG_URL=postgresql://postgres@localhost/postgres npm test` (each file gets a fresh database cloned from a migrated template). The S3 adapter tests need `pip install "moto[server]"` and are skipped without it.
- Browser walkthroughs (Playwright for Python, Chrome): start the app in development mode on port 3000, then `python3 tests/e2e/walkthrough*.py`. `walkthrough_supabase.py` starts its own stand-in identity provider (`tests/fake-gotrue.ts`) and an app server on port 3001 in Supabase mode.
- CI (`.github/workflows/ci.yml`) is **manual trigger only** until the founder enables automatic runs.
