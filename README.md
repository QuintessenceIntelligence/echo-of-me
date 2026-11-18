# Echo of Me: application

*Because your love deserves a voice beyond time.* · By Quintessence Intelligence

**Status: pre-release, local development only.** Vertical slices 1 (consent and onboarding), 2 (memory capture and provenance) and 3a (grounded answers without an AI model) are built and tested. Nothing is deployed. Do not store real personal material.

Product source of truth: the `canonical/` documents in the Echo of Me Claude Project (00 README, R2 decisions, 01D MVP boundary). Architecture decisions: `docs/adr/`. Latest test evidence: `tests/results/`.

## Slices (DR-040)
| # | Slice | Status |
|---|---|---|
| 1 | Author consent and onboarding | **Built, tested** (`tests/results/Slice_1_Test_Results_v1.0.md`) |
| 2 | Memory capture and provenance | **Built, tested** (`tests/results/Slice_2_Test_Results_v1.0.md`, ADR-006) |
| 3 | Secure retrieval | **3a built, tested**: provider-free grounded answers for author rehearsal (ADR-007a, `tests/results/Slice_3a_Test_Results_v1.0.md`). AI composer awaits ADR-007 |
| 4 | Author preview (rehearsal) | **Built, tested** (ADR-008, `tests/results/Slice_4_Test_Results_v1.0.md`): practise questions, pin, suppress, answer it yourself |
| 5 | Recipient roles and release governance | **Built, tested** for living-author sharing (ADR-009, `tests/results/Slice_5_Test_Results_v1.0.md`): share approved items with adult recipients, recipient questions and reports. Posthumous/milestone release not in MVP |
| 6 | Pilot telemetry | Not started |

## Layout
```text
app/                 Next.js pages and server actions (thin adapters)
src/domain/          business rules and policy checks (consent, onboarding, vault, export, audit)
src/server/          database access (withActor / withSystem), sessions, migrations, blob storage, zip
db/migrations/       ordered SQL, incl. row-level security
db/seed/             consent texts (v0.1-draft, not legally reviewed)
docs/adr/            architecture decisions
tests/               vitest (real Postgres), e2e/ browser walkthrough, results/
```

## Run locally
1. Postgres 16+ running. Copy `.env.example` to `.env.local` and fill it in.
2. `npm install && npm run db:migrate`
3. `npm run dev` → http://localhost:3000 (development sign-in, simulated second factor; media stored under `STORAGE_DIR`, default `.data/blobs`)
4. Tests: `TEST_PG_URL=postgresql://postgres@localhost/postgres npm test`
