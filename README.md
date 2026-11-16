# Echo of Me: application

*Because your love deserves a voice beyond time.* · By Quintessence Intelligence

**Status: pre-release, local development only.** Vertical slice 1 (author consent and onboarding) is built and tested. Nothing is deployed. Do not store real personal material.

Product source of truth: the `canonical/` documents in the Echo of Me Claude Project (00 README, R2 decisions, 01D MVP boundary). Architecture decisions: `docs/adr/`. Latest test evidence: `tests/results/`.

## Slices (DR-040)
| # | Slice | Status |
|---|---|---|
| 1 | Author consent and onboarding | **Built, tested** (`tests/results/Slice_1_Test_Results_v1.0.md`) |
| 2 | Memory capture and provenance | Next |
| 3 | Secure retrieval (AI, needs G4 + provider approval) | Not started |
| 4 | Author preview (rehearsal) | Not started |
| 5 | Recipient roles and release governance | Not started |
| 6 | Pilot telemetry | Not started |

## Layout
```text
app/                 Next.js pages and server actions (thin adapters)
src/domain/          business rules and policy checks (consent, onboarding, audit)
src/server/          database access (withActor / withSystem), sessions, migrations
db/migrations/       ordered SQL, incl. row-level security
db/seed/             consent texts (v0.1-draft, not legally reviewed)
docs/adr/            architecture decisions
tests/               vitest (real Postgres), e2e/ browser walkthrough, results/
```

## Run locally
1. Postgres 16+ running. Copy `.env.example` to `.env.local` and fill it in.
2. `npm install && npm run db:migrate`
3. `npm run dev` → http://localhost:3000 (development sign-in, simulated second factor)
4. Tests: `TEST_PG_URL=postgresql://postgres@localhost/postgres npm test`
