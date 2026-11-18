# Echo of Me | Slice 5 test results (sharing with adult recipients)

| Field | Value |
|---|---|
| Version | v1.0 |
| Run date | 19 November 2026, ~00:15 SAST |
| Build | branch `slice-5` (merged to `main`) |
| Environment | Local only: Node 22, PostgreSQL 16, Next.js 16.4 production build, headless Chrome with two separate sessions (author and recipient). Synthetic data only. |
| Result | **97/97 unit and database tests** (15 new) · **17/17 slice-5 browser steps** · regressions: slice 1 17/17, slice 2 23/23, slice 3a 8/8, slice 4 10/10 · **0 axe violations** |

## 1. What was verified
| Area | Evidence | Status |
|---|---|---|
| AC-02 nothing until shared | Joined recipient sees no items; their questions find nothing (unit + browser) | **Met** |
| Exactly what was shared | Recipient sees the current approved words, original recording and approved transcript of shared items only; not drafts, earlier versions, tags, audience, rules, grants, practice history, unapproved transcripts or unshared items (unit, raw SQL as the recipient, browser) | **Met** |
| Recipient answers | Quote only shared approved words; an approved but unshared item is never used; adjacent suggestions only from shared items; identity and crisis behave as for the author; the author's pins and suppressions apply; a pin on an unshared item is inactive | **Met** |
| Access ends at once | Edit (draft), stop sharing, stop sharing everything with a person, removing the person, withdrawing the sharing consent (grants deleted), legacy no longer active; re-approval restores with the new words (unit + browser) | **Met** |
| Sharing rules | Needs second factor, sharing consent, approved item; sensitive needs confirmation; children, never-invited, revoked and other legacies' recipients refused; invited people can be shared with in advance and see it on acceptance | **Met** |
| AC-08 isolation | Other families and their recipients cannot list, ask, read rows or search; recipients cannot grant themselves access, update items or add versions | **Met** |
| Privacy of questions | Recipient questions invisible to the author and other recipients; author's log shows evidence class and source ids only; crisis questions stored without text | **Met** |
| Reports | Reason, note, question only when included; sources resolved for the author; only "resolved" can be changed; others cannot report someone else's answer; safety messages cannot be reported | **Met** |
| AC-13 access log | Share grant/revoke, recipient view, recording play, recipient answer, report — all in the author's log | **Met** |
| AC-14 | axe: share panel, recipient page, recipient answer, reports page — 0 violations | Automated only |

## 2. Not done (honest status)
- **Mutation checks were not run for slice 5.** The automated safety system blocked temporarily weakening the access-control rules in the working copy; I did not work around it. The explicit tests above cover each access condition individually.
- Release on milestones or after death is not built (MVP excludes it, DR-032).
- Recipients' own consent to AI answers is covered only by the draft recipient terms text ⚖.
