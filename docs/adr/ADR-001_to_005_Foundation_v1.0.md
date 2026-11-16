# Echo of Me | ADR-001 to ADR-005: Foundation architecture

| Field | Value |
|---|---|
| Version | v1.0 |
| Date | 16 November 2026 |
| Author | Claude (routine technical decisions delegated under DR-051) |
| Status | **ACCEPTED as working defaults for slice 1–2; reversible.** None of these spends money, signs up a vendor or fixes a hosting region. Items marked **FOUNDER** need approval before production. |
| Related | R2 DR-022, DR-027 (G5), DR-031, DR-038, DR-041, DR-051; 01B §4; 01D AC-01/02/08/13 |

---

## ADR-001 Client platform
**Decision.** Responsive web application built with **Next.js (App Router) + React + TypeScript**, server-rendered, no client-side data store.
**Why.** Matches the recommended G5 default (web first, DR-027). Server rendering keeps personal data and policy on the server. One codebase for author and recipient views.
**Alternatives.** React Native (2025 shortlist, DR-034): deferred until validation. SPA + separate API: more surface area, no benefit at this stage.
**Consequences.** Native apps later can call the same domain layer through an API. If G5 changes, the domain and database layers are unaffected.

## ADR-002 Backend runtime and code structure
**Decision.** Node.js 22 LTS. All business rules live in a framework-independent **domain layer** (`src/domain/`). Next.js server actions are thin adapters that call it. The domain layer is the application **policy enforcement point**.
**Why.** Keeps rules testable without a browser (22 tests run in ~1 s against real Postgres) and portable if the web framework changes.
**Alternatives.** Python FastAPI (2025 shortlist): fine, but two languages for one small team adds cost. Can be revisited for the AI pipeline (slice 3) without touching this layer.

## ADR-003 Data platform
**Decision.** **PostgreSQL 16+**, schema managed by plain, ordered SQL migrations (`db/migrations/`), reference data in `db/seed/`. `pgvector` is the default candidate for the derived retrieval index (slice 3, separate ADR). Encrypted object storage for original media arrives with slice 2.
**Why.** Relational integrity for consent, permissions and audit; row-level security for per-legacy isolation; widely available managed hosting (Supabase, Neon, AWS RDS, Azure) so there is no lock-in. Plain SQL works with any of them.
**FOUNDER.** Choice of managed provider and **hosting region** (POPIA cross-border question, A-14, DR-038) is ADR-009 and needs approval. Local development uses a local Postgres.

## ADR-004 Identity and second factor
**Decision.** Sign-in and MFA will come from an **external identity provider**; the app consumes only a verified subject id and an assurance level (`aal1` / `aal2`). Recommended default: **Supabase Auth** (TOTP MFA, same vendor as the likely database host). Alternatives: Clerk, Auth0, AWS Cognito.
**Rules already enforced in code.**
- Actions that expose data to other people (creating invitations) require `aal2`.
- Giving and withdrawing consent need only a signed-in session: withdrawing must be as easy as giving.
- Until a provider is approved, the app runs only with `AUTH_MODE=dev`: a development sign-in and a **simulated** second factor, both labelled in the UI. Any other mode disables sign-in rather than falling back.
**FOUNDER.** Selecting and signing up the provider (vendor + possible cost).
**Not done.** Real MFA, account recovery, identity proofing. The `aal` check is real; the factor behind it is simulated.

## ADR-005 Isolation and policy enforcement (defence in depth)
**Decision.** Two independent layers must both allow an action:
1. **Application layer.** Every domain operation checks ownership and policy (consent, MFA, minor status) and returns "not found" for anything not yours, so responses never reveal another family's data. Refusals are written to the audit log in a separate transaction so they survive the rollback.
2. **Database layer.** Runtime queries run inside a transaction that does `SET LOCAL ROLE echo_app` and sets `app.account_id`. `echo_app` is not the table owner and has no `BYPASSRLS`; every table has `FORCE ROW LEVEL SECURITY`. Policies: a legacy and all its child rows are visible only to the owner; consent and audit rows only to their subject/owner.

**Append-only records.** `consent_event`, `audit_event` and `consent_document` reject UPDATE/DELETE through triggers (even for the owner role) and through grants.
**Privileged paths (complete list).** `withSystem()` is used only for: account provisioning from the identity provider; migrations and seed data. Two `SECURITY DEFINER` functions exist: `app.accept_invitation(token)` (re-checks token, expiry, revocation and email match) and `app.my_recipient_memberships()` (returns only legacy title and author display name).
**Recipients.** Adding or inviting a recipient creates **no** access. Content grants arrive in slice 5 and will be added as explicit `access_grant` rows checked by both layers.
**Evidence.** `tests/isolation.test.ts` (raw SQL as `echo_app` against another family's rows: 0 reads, 0 writes) and mutation checks showing the tests fail when a policy is weakened.

## Planned next ADRs
ADR-006 grounding method (RAG, DR-022) · ADR-007 model-provider abstraction and provider (DR-016, **FOUNDER**) · ADR-008 transcription (**FOUNDER** if paid) · ADR-009 hosting and region (**FOUNDER**) · ADR-010 object storage and encryption of originals (slice 2).
