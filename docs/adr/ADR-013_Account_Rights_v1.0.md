# ADR-013: Personal-data rights for every account (leave, download, close)

| Field | Value |
|---|---|
| Status | ACCEPTED (routine technical decision by Claude, session 4). Wording and retention periods ⚖ need legal review. |
| Date | 19 November 2026 |
| Migration | `db/migrations/0014_account_rights.sql` |
| Code | `src/domain/account.ts`, `src/server/db.ts` (`app.set_actor`), `app/account/`, `app/account-actions.ts` |
| Tests | `tests/account-rights.test.ts` (7 tests; 2 mutation checks detected); browser `tests/e2e/walkthrough_account.py` (11 steps, 0 axe violations) |

## Context
Authors could already export and delete their whole legacy (AC-12). Recipients, and anyone who had deleted their legacy, had no way to see what was held about them, to stop being a recipient, or to close their account. POPIA gives data subjects rights of access, correction and deletion, and objection (⚖ the exact obligations for this product need legal review; this ADR does not claim compliance). Doc 03 also noted that nothing stopped a stale session from acting after an account should have ended.

## Decision
1. **Your account page** (`/account`, linked from the header): name, email, created date, and the three rights below.
2. **Download your data** (POST, same-origin only, second factor required, counted against the export rate limit): a JSON file with the account, its consent history (with document versions and text hashes), legacies joined, questions asked, reports made and the account's own activity log. It deliberately excludes the content of legacies, which belongs to their authors.
3. **Leave a legacy** (recipients): `app.leave_legacy` ends access at once, removes every share to that person, deletes their questions in that legacy (and reports about those answers, which reference the questions), and marks the author's record of them **"left"**. The author sees "Left (you can invite them again)" and an activity entry. Sharing with someone who left is refused until they are invited again; rejoining starts with nothing shared.
4. **Close your account** (second factor + typed email + tick box):
   - Refused while the person authors a legacy: they must export and delete it first. Closing never deletes a legacy implicitly.
   - Every membership is left (each author's log shows it, reason "account closed"); remaining questions and rate-limit counters are deleted.
   - The account row is **anonymised, not deleted**: name → "Closed account", email → `closed-<id>@closed.invalid`, identity-provider subject → `closed|<id>`, `closed_at` set (a constraint enforces this shape). Consent records and the activity log keep the same opaque id and contain no names, emails or content. The same email can sign up again later as a new person.
   - The session is cleared.
5. **A closed or unknown account can do nothing.** Every request now sets its actor through `app.set_actor`, which refuses closed or non-existent accounts (`AccountUnavailableError`), so a stale cookie on another device cannot act. No extra round trip: it replaces the previous `set_config` call.
6. **Accounts can no longer be changed directly by the application role** (update grant and self-update policy removed); changes go only through the functions above.

## Consequences and known limits
- ⚖ **Retention of anonymised consent and audit records** after closure is not yet set (proposed: keep for the period a legal reviewer specifies, then purge). Purging is not built.
- ⚖ When a recipient leaves or closes their account, **reports they made are deleted** with their questions, so the author loses that feedback. Chosen in favour of the reporter's privacy; confirm at review.
- The author's **record of a recipient** (name, relationship, email the author typed) stays in the author's legacy after the recipient leaves or closes their account: it is the author's own data about their family. ⚖ confirm.
- **Real sign-in is not connected yet** (ADR-004). When Supabase Auth is added, closing an account must also delete the identity-provider user and revoke its sessions; until then `app.set_actor` is the safeguard.
- Minors have no accounts (DR-026), so none of this applies to them.
