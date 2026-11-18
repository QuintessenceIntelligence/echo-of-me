# ADR-012: Per-account rate limits

| Field | Value |
|---|---|
| Status | ACCEPTED (routine technical decision by Claude, session 4; no cost, no vendor) |
| Date | 19 November 2026 |
| Migration | `db/migrations/0013_rate_limits.sql` |
| Code | `src/domain/limits.ts`; called from `rehearsal.ts`, `vault.ts`, `onboarding.ts`, `sharing.ts`, `export.ts` |
| Tests | `tests/limits.test.ts` (6 tests); full suite 117/117; browser walkthroughs 90/90 |

## Context
Doc 03 listed "no rate limiting" as a gap before a hosted pilot. Without limits, one signed-in account could script thousands of questions, uploads, invitations or exports. Today that costs database time and storage; once an AI provider is chosen (ADR-007) it would also cost money, which is outside the R0 spending authority (DR-054). The app will run on serverless hosting, so counters kept in a process's memory would not hold across instances.

## Decision
1. **Counters live in Postgres** (`rate_limit` table, fixed windows), so limits hold across serverless instances with no new vendor.
2. **The application role cannot touch the table.** FORCE RLS with no policies and no grants; the only way in is `app.rate_limit_hit(action, window_seconds)`, a SECURITY DEFINER function that counts against the signed-in account's own bucket and returns the hits in the current window. Action names, window lengths (1 s to 24 h) and the presence of an account are checked.
3. **Attempts are counted before the action, in their own committed transaction.** Failed and refused attempts count too, so bad input cannot be used to hammer the server without limit.
4. **Only the first refusal in each window is logged** (`rate_limit.refused` in the activity log, with the limit name and size), so a flood of attempts cannot flood the log.
5. **Defaults** (per account), set generously so real use never meets them:

| Limit | Allowance | Covers |
|---|---|---|
| `ask` | 60 per 10 min | author practice questions |
| `recipient_ask` | 30 per 10 min | recipient questions |
| `upload` | 40 per hour | recordings and photos |
| `invite` | 20 per hour | invitation links |
| `export` | 10 per hour | full exports (counted after authorisation, because exports are heavy) |
| `report` | 20 per hour | answer reports |

People see a calm message: "You are doing that very often. Please wait a little (up to N minutes) and try again."

## Not covered (known limits)
- **Sign-in and sign-up attempts** are not limited here: they will be handled by Supabase Auth's own rate limits when real sign-in is connected (ADR-004).
- **Per-IP limits** for unauthenticated pages (invitation acceptance by token) are left to the hosting layer (Vercel firewall rules), to be set when the hosted preview exists. Invitation tokens are 256-bit random and single-use, so guessing is not practical.
- **Fixed windows** allow up to twice the allowance across a window boundary. Acceptable at these sizes; a sliding window can replace it without changing callers.
- **Account deletion** is not built yet; when it is, it must also delete the account's `rate_limit` rows (the bucket key contains the account id).

## Alternatives considered
- In-memory counters: do not hold across serverless instances. Rejected.
- A hosted key-value store (e.g. Redis): new vendor and possible cost; needs founder approval. Not needed at pilot scale.
- Counting only successful actions (inside the action's transaction): lets failing requests through without limit. Rejected after self-review.
