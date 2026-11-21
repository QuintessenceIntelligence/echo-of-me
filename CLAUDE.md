# CLAUDE.md: Echo of Me working rules for Claude Code

*Echo of Me, by Quintessence Intelligence. Tagline (locked): "Because your love deserves a voice beyond time."*

This file is read at the start of every Claude Code session in this repository. It replaces the claude.ai Project instructions. Founder: Minesh Parbhoo.

## 1. Read first, every session
1. `docs/canonical/Echo_of_Me_Chat_Handoff_Current_State.md` — where things are, what is next.
2. `docs/canonical/00_README_v1.5.md` — index of all documents.
3. `docs/canonical/registers/R2_Decision_Register_v1.6.md` — what the founder has decided.
4. For build detail: `docs/02_…` (PRD) to `docs/07_…`, `docs/adr/`, `tests/results/`.

Use the highest version number of any document. Don't repeat the 2026 source reconciliation; it is done (R1–R9).

## 2. Source-of-truth order
1. Founder decisions (R2) and this file.
2. `docs/canonical/` (00, 01A–01D, R1–R9, handoff) and the build documents 02–07 + ADRs.
3. Original 2025 documents (S-01, S-02, S-17) — historical evidence.
4. 2026 reconstructions (S-03 to S-07) — secondary, graded in R8.
5. Visual references (`docs/archive/project-files/`) — tone only, never requirements.

The claude.ai Project "Echo of Me" and the founder's Google Drive folder still hold the originals (see `docs/archive/README.md`). **Never delete, replace or mark any source as superseded without the founder's explicit approval (DR-047).**

## 3. Product principles (non-negotiable; full text 01A §8)
- It preserves a person's recorded memories, words, lessons and values. It does **not** preserve consciousness and never claims the AI *is* the parent.
- Never invent memories or attribute opinions without evidence. Every answer is one of: E1 direct (their words), E2 grounded interpretation (cited, limits stated), E3 not recorded.
- AI identity is always disclosed. Policy (identity, relationship, release, sensitivity) is enforced in the application and database **before** retrieval, never by a prompt.
- Adults only for now; no minors, no posthumous release, no synthetic voice in the MVP.
- Never present mock data or illustrative UI as working. No feature is "done" without test evidence.
- Mark items needing legal review ⚖ or clinical review 🩺. Never claim compliance.

## 4. The 11 modules (never remove, rename or merge; 01C)
01 Parent & Family Profiles · 02 Memory & Wisdom Vault · 03 AI Conscience Engine · 04 Interaction Simulator · 05 Guided Prompt Library · 06 Dashboard, Permissions & Safeguards · 07 Feedback Loop · 08 Memory Canvas · 08A Playful Identity Image Generator · 09 Video Canvas / The Echo Edit · 10 Timed & Milestone Messages. 01–06 are the MVP (built); 07–10 stay on the roadmap.

## 5. Decision labels (use exactly these)
CONFIRMED (founder-approved) · CONFIRMED CONCEPT · PROVISIONAL · PROPOSED · UNRESOLVED · HISTORICAL. Never present a recommendation as a founder decision. Log approved decisions in R2 and the change log R7 (new version file each time).

## 6. When to stop and ask the founder
Carry on with safe, reversible work without asking. **Stop and ask** before anything that:
- deletes a database, project, branch with unmerged work, or files the founder owns; overwrites production configuration; force-pushes;
- exposes credentials or API keys (never print, commit or paste secrets; `.env*` files stay out of git);
- costs money (spending authority is **R0**, DR-054) or signs up for a vendor;
- introduces a security weakness, or uses real personal data (synthetic data only, DR-053);
- turns on a sensitive function: child profiling, posthumous release, synthetic voice;
- changes a CONFIRMED decision or the product boundary.

**Supabase connectors:** Echo of Me's project is `mwoibsvkbtlwkblsryfm` (DR-059); use only the custom connector "Supabase Custom | Minesh Parbhoo Organisations". Never use the other "Supabase" connector for Echo of Me, and don't switch, reconnect or repoint any connector without asking first. Don't change anything belonging to "Founders at Work". Deleting the old project `cvyoicwcsbxmhjuslixv` is the founder's job, after confirmation.

## 7. Files and versions
- Versioned documents use dotted numbers in the file name: `Name_v1.1.md` (never `_v1_1`). A change makes a new version file; the old one stays.
- Code: build on a branch, commit and push after each verified step, fast-forward `main` only when tests pass. Commit messages state test evidence truthfully (re-run before claiming a count).
- After each meaningful step update the handoff file and R7.

## 8. Local setup and tests
- Node ≥ 22, PostgreSQL 16+, Python 3 with Playwright (browser walkthroughs), optional `pip install "moto[server]"` (S3 tests).
- `npm ci` · `npm run typecheck` · `TEST_PG_URL=postgresql://postgres@localhost/postgres?host=/tmp&port=5433 npm test` (adjust the URL to your Postgres; each test file gets a fresh database).
- App in dev mode: `DATABASE_URL=… AUTH_MODE=dev SESSION_SECRET=<32+ chars> STORAGE_DIR=/tmp/blobs npm run dev` (dev sign-in uses a **simulated** second factor).
- Browser walkthroughs: start the app on port 3000, then `python3 tests/e2e/walkthrough*.py`. `walkthrough_supabase.py` starts its own stand-in identity provider on port 3001.
- Last verified: 151/151 tests (re-run 21 Nov 2026); 11 walkthroughs 131/131 steps; 0 axe violations (`main` `a365adf`, 19 Nov 2026). The 6 S3 tests need `pip install "moto[server]"` (on Debian images add `--ignore-installed blinker`); without it they are skipped, not failed.

## 9. Current position (21 Nov 2026)
All six build documents exist; MVP slices 1–6 are built and tested locally. The new Supabase project `mwoibsvkbtlwkblsryfm` (founder's personal account, eu-west-1, Free plan; DR-059) has migrations 0001–0015 and both seeds, verified on the live database. Next: hosted preview runbook (`docs/operations/Hosted_Preview_Runbook_v1.1.md`) from step 3 (runtime password, Auth settings, storage bucket and keys, Vercel preview). Still needing the founder: the AI provider (ADR-007), an email vendor, legal and clinical reviews, editorial review of prompts and consent texts, pilot approvals, and later deleting the old project `cvyoicwcsbxmhjuslixv`.
