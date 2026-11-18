# ADR-009 Sharing with adult recipients and recipient questions (slice 5)

| Field | Value |
|---|---|
| Status | **Accepted** (technical decision under DR-051, within the MVP scope decided by DR-026 adults only, DR-032 living-author sharing only, DR-042 roles) |
| Date | 18 November 2026 |
| Implements | Module 01/04/06: author-initiated sharing; adult-recipient Q&A; report an answer. AC-02, AC-08, AC-09, AC-10, AC-13 for recipients |
| Code | `db/migrations/0010_sharing_and_recipient_access.sql`, `src/domain/sharing.ts`, `src/domain/rehearsal.ts` (`composeAnswer`, `recipientAsk`), `app/shared/`, `app/legacy/reports/`, share panel on the memory page |

## Decisions
1. **Explicit per-item grants** (`share_grant`), set by the author with a verified second factor, the "share with recipients" consent, an active legacy and an approved item. Sensitive items need an explicit confirmation (`sensitive_confirmed`). Recipients must be adults who were invited; sharing in advance of acceptance is allowed and takes effect on acceptance. The earlier "intended for" field (ADR-006) remains a planning note and grants nothing.
2. **Access is decided by the database on every read.** `app.shared_with_me(item)` requires: grant, recipient accepted and adult, legacy `active`, item approved, sensitive confirmed, and the author's sharing consent currently granted. So unapproving (any edit), removing or revoking a recipient, freezing the legacy or withdrawing consent cuts access at once; re-approval restores it with the new wording.
3. **Recipient read policies, not a second data path.** Recipients get SELECT row-level policies on items, the current version only, originals and approved transcripts of shared items. No access to drafts, history, tags, audience, rules, grants or the author's practice history. `citable_source`, `app.search_citable` and `/media` therefore serve recipients unchanged, and the retrieval boundary stays single.
4. **One answer pipeline** (`composeAnswer`) for author practice and recipients; the author's pins and suppressions apply to recipients through `app.answer_rules_for`, and a pin on an item not shared with that recipient is inactive. Recipient answers need the author's AI-processing consent; reading shared items does not.
5. **Privacy of recipient questions.** `recipient_turn` is readable only by the asker. The author's activity log gets "a recipient asked a question" with evidence class and source ids, never the question. Crisis questions are stored without text.
6. **Reports.** A recipient may report an answer (reason, optional note, and their question only if they tick the box). The author sees reports and may only mark them resolved (column-level grant).
7. **Withdrawing the sharing consent deletes all grants** (and pending invitations, as before). The draft consent text v0.1 mentions only invitations; the behaviour is more protective than the text ⚖ (to align at legal review).
8. **Access logging:** grants, revocations, recipient page views, recording plays and answers are in the author's log (AC-13).

## Consequences
- Posthumous or milestone release (DR-009, module 10) will add release conditions to `app.shared_with_me`; the current rule is "living author, active legacy, share now".
- `SECURITY DEFINER` helpers rely on the function owner bypassing RLS (true locally; to verify on Supabase when 0006–0010 are applied).
