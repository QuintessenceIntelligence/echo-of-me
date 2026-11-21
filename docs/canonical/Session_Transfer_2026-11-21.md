# CONTEXT TRANSFER | Echo of Me: move from the claude.ai Project to Claude Code | 21 Nov 2026

## 1. Instructions for the receiving AI
- Treat this file as shared history. You are continuing the same work, now inside Claude Code in the repo `QuintessenceIntelligence/echo-of-me`.
- Read `CLAUDE.md`, then `docs/canonical/Echo_of_Me_Chat_Handoff_Current_State.md`, then `docs/canonical/00_README_v1.4.md` and `docs/canonical/registers/R2_Decision_Register_v1.5.md`.
- Keep CONFIRMED decisions and locked wording exactly as they are. Continue from §10; don't redo the source reconciliation or the finished build work.
- Ask only for things this file and the repo don't contain. Nothing needs re-attaching: everything needed is in the repo; the originals also stay in the claude.ai Project and Google Drive (`docs/archive/README.md`).

## 2. Overview
Echo of Me (by Quintessence Intelligence) is a digital-legacy app: parents record memories and values; chosen adults later ask questions and get answers that quote or cite the parent's own approved words, or say "not recorded". MVP modules 01–06 are built and tested locally on synthetic data. On 21 Nov 2026 the founder chose to move the whole project from the claude.ai Project into Claude Code and to use a new Supabase account with a custom connector.

## 3. About me and how I work (founder)
- Minesh Parbhoo, founder, Quintessence Intelligence (South Africa).
- Wants plain language and step-by-step instructions ("like I'm 15") for anything he must do himself.
- Rules he set, still in force:
  - [Confirmed] "Don't switch the Supabase connector without asking me first."
  - [Confirmed] Stop only for destructive actions (deleting databases, overwriting production configs, force-pushing), exposing credentials/API keys, real financial costs, or a critical security weakness. Otherwise proceed autonomously.
  - [Confirmed] Synthetic data only (DR-053). Spending authority R0 (DR-054).
  - [Confirmed] Never present simulated features as working.
  - [Confirmed] Don't change "Founders at Work" (a separate project).
  - [Confirmed] Don't delete or supersede any source (DR-047).
  - [Confirmed] Dotted version numbers in file names (`_v1.1.md`).
  - [Confirmed] Commit and push at each step; update the handoff.
  - Correction learned: a commit once claimed 151/151 after a failed run; always re-run before stating test counts.

## 4. Goals
- Now: finish the migration so Claude Code has everything, then connect the new Supabase project and run the hosted private preview (runbook).
- Done looks like: repo holds all canonical docs + CLAUDE.md + this transfer; founder can open Claude Code, clone, and continue without losing context.

## 5. Key decisions and reasoning
- [Confirmed] Migrate to Claude Code by mirroring the Project's canonical docs into `docs/canonical/` (repo becomes the primary source of truth), copying the Project files into `docs/archive/project-files/`, writing `CLAUDE.md` in place of Project instructions, and saving this transfer. The claude.ai Project and Drive are kept, not deleted, because they hold the original sources.
- [Confirmed] Historical sources S-01–S-07 were not copied byte for byte (every unique item is already carried into the canonical docs per R1 §4). Copying them later is optional.
- [Proposed] Use the founder's new Supabase account/custom connector for Echo of Me. This would supersede the earlier dev project (DR-058: account echo-of-me@quintessenceintelligence.com, project ref `cvyoicwcsbxmhjuslixv`, eu-west-1). Needs founder confirmation and an R2 entry.

## 6. Requirements and constraints
See `CLAUDE.md` §3 and §6. The headline ones: adults only, no posthumous release, no synthetic voice in MVP; policy enforced in the database before retrieval; doc 05 §13 go/no-go for real data is currently **no-go**.

## 7. Progress
**Completed:**
- Slices 1–6, account rights, rate limits, strict CSP, S3 storage adapter (vs moto), Supabase Auth + TOTP + password reset + new-phone authenticator swap (vs a stand-in), chunked uploads, keyboard accessibility. `main` = `a365adf`; 151/151 tests; 11 walkthroughs 131/131; 0 axe.
- All six build docs: 02 v1.0, 03 v1.2, 04 v1.0, 05 v0.1 draft, 06 v1.0, 07 v1.0.
- 21 Nov: `docs/canonical/` (00 README v1.3/v1.4, 01A–01D, handoff, R1–R9 incl. R2 v1.5 and R7 v1.4/v1.5), `docs/archive/` (7 PNGs + index), `CLAUDE.md`, README pointer update, this file.
**Not started:** byte copies of S-01–S-07 and S-17 in `docs/archive/sources/` (optional).
**Pending (founder):**
1. Which Supabase account/organisation/project is Echo of Me's now? Does it replace project `cvyoicwcsbxmhjuslixv`?
2. Is a project created yet, and in which region?
3. Is the custom connector linked to it? If yes, Claude does read-only checks first.
Then: Supabase Pro (~US$25/month) or Free-plan decision; ADR-007 AI provider; email vendor; legal and clinical reviews; editorial review of 35 draft prompts and consent texts; pilot approvals.
**Blocked:** live verification of ADR-014 (storage) and ADR-015 (sign-in) on real Supabase, and migrations 0006–0015 + seed 0002, until the Supabase questions are answered.

## 8. Technical details
- Repo: `QuintessenceIntelligence/echo-of-me` (private). Stack: Next.js 16, React 19, TypeScript, Node 22, PostgreSQL 16 with forced RLS per legacy, vitest on real Postgres, Playwright (Python) + axe-core.
- Local Postgres used in cloud sessions: port 5433, socket `/tmp`; test URL `postgresql://postgres@localhost/postgres?host=/tmp&port=5433`.
- App dev run: `DATABASE_URL=… AUTH_MODE=dev SESSION_SECRET=<32+ chars> STORAGE_DIR=/tmp/blobs npx next start -p 3000`; stop with `pkill -f next-server`.
- Push tip used in cloud sessions: `git -c push.negotiate=true push`.
- Supabase custom connector seen in this session: "Supabase Custom Minesh Parbhoo Organisations" (tools: execute_sql, apply_migration, list_tables, get_project_url, get_publishable_keys, get_advisors…). Not used yet.
- Pilot cost model (PROPOSED, doc 06): ≈ US$90–127 / R1,530–R2,160 for 2 months, 20 households, excluding legal/clinical fees.

## 10. Where we left off
- Last step: repo mirror + CLAUDE.md + this file written; being committed to `main`.
- Founder's latest request: do the migration and give him child-simple step-by-step instructions for his side.
- Waiting on: the three Supabase answers in §7.

## 11. Next steps
1. (Founder) Open Claude Code, clone the repo, start a session, check connectors with `/mcp`.
2. (Founder) Answer the three Supabase questions.
3. (Claude, after the answers) Read-only check of the new project; propose the R2 entry superseding DR-058; then apply migrations 0001–0015 + seeds on the confirmed project and follow `docs/operations/Hosted_Preview_Runbook_v1.0.md`.

## 12. Other critical context
- Supabase connectors are single-organisation; switching affects other projects (Founders at Work). Always ask first.
- R1 says a byte copy of S-17 (checklist xlsx) is in the repo archive; none was found on 21 Nov. Its full content is in R1 §4.
