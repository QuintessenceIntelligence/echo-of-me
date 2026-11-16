# Echo of Me | Vertical slice 2 test results (memory capture & provenance)

| Field | Value |
|---|---|
| Version | v1.0 |
| Run date | 17 November 2026, ~01:30 SAST |
| Build | branch `slice-2` (merged to `main`), see git log |
| Environment | Local only: Node 22, PostgreSQL 16.15, Next.js 16.4 production build, headless Chrome with Chrome's fake microphone. **Not deployed anywhere. Synthetic data only.** |
| Result | **53/53 unit and database tests passed** (25 slice-1 + 28 new) · **23/23 slice-2 browser steps passed** · **17/17 slice-1 browser steps still pass** · **0 automated accessibility violations** (axe-core, WCAG 2.0–2.2 A/AA) on 4 new screens · **4/4 deliberate safeguard breakages detected** |

## 1. Acceptance criteria (01D §4)

| Criterion | Evidence | Status |
|---|---|---|
| **AC-03** Audio retrievable byte-identical after transcription, editing and export | Unit: WAV uploaded → transcript saved twice and approved → item edited → read back identical; exported ZIP extracted with `unzip`, file identical, `sha256sum -c SHA256SUMS` OK. Browser: a real WebM recorded in Chrome and an uploaded WAV both served identical to their fingerprints and found byte-identical in the downloaded export. Tampered file detected and refused (playback and export), logged as integrity failure. | **Met** (local storage) |
| **AC-04** Machine transcripts and AI tags unapproved and never cited until approved | Unit: machine transcript is P6 and absent from `citable_source` even when its item is approved; approval makes it P3; a new version drops it out again; an approved transcript of a draft item is not citable; suggestions are P6 and never appear in the view. Browser: transcript badge changes from "Unapproved, never used in answers" to "Transcript you approved". | **Met** for the citable boundary; enforcement in answers follows in slice 3, which must read only `citable_source` |
| **AC-05** (rule part) Editing/deleting approved material removes it from use | Unit + browser: editing creates version 2, keeps version 1, returns the item to draft; the old wording disappears from `citable_source` in the same transaction; adding or removing a recording also returns it to draft. | **Rule met**; index window applies once slice 3 has an index |
| **AC-08** (foundation) No cross-legacy access | `slice2-isolation.test.ts`: 28 operations by another family (incl. own-legacy-id + foreign-item-id tricks) → all "not found", 0 changes, every write attempt audited as denied; raw SQL as the app role sees 0 rows in all 8 vault tables/views and cannot insert, update or delete; composite keys block cross-legacy links even for the owner of both; a joined recipient sees 0 vault rows. Browser: another signed-in person gets 404 for the recording and "not found" for the page; signed-out request 404. | **Foundation met** |
| **AC-12** (start) Export all originals and metadata in open formats | ZIP with `legacy.json`, originals, `SHA256SUMS`; validated by `unzip -t`, Python `zipfile.testzip`, `sha256sum -c`; needs MFA; audited. Item deletion removes every version, recording, transcript, tag and file; audit trail kept. | **Export met; legacy-level deletion not yet built** |
| **AC-13** (part) Audit log | New actions logged with ids, versions, counts, sizes and reasons only; browser confirms the log contains no memory words. | **Partially met** |
| **AC-14** WCAG 2.2 AA (target) | axe-core: 0 violations on memories (empty), memory detail with recordings and suggestions, memories list, export | **Automated check only** |

## 2. Other safeguards verified
- Audio requires the "Storing your voice recordings" consent (refusal audited); photos do not. Automatic suggestions require the AI-processing consent; withdrawing it removes pending suggestions and keeps the author's decisions.
- File type decided from the bytes: a text file named `.mp3`, an SVG with a script, and an MP4 video are refused; oversized files refused; a browser "recording" must be audio. Uploaded file names are reduced to a safe base name (`../../etc/passwd` → `passwd`).
- Versions, transcripts and originals cannot be altered by the app role (permission denied) or even the database owner (trigger).
- Saving from an out-of-date page is refused ("changed in another window"); approving an empty item is refused.
- Local disk storage is refused on any hosted deployment; the least-privilege login has no access to the new tables without `SET ROLE echo_app` and can run capture end to end with it.
- Recordings are served author-only, re-verified, `no-store`, `nosniff`, sandboxed CSP.

## 3. Mutation checks (do the tests catch real regressions?)
| Deliberate breakage | Tests failing |
|---|---|
| `citable_source` ignores transcript approval | 1 |
| Export without MFA | 2 |
| `memory_item` RLS opened to everyone | 2 |
| Integrity check removed from playback | 1 |

## 4. Bugs found and fixed during testing
1. **Export download crashed (500)** when clicked in Chrome: the site's `Referrer-Policy: no-referrer` makes Chrome send `Origin: null`, which the origin check tried to parse. Fixed with a `Sec-Fetch-Site`-based same-site check that never throws (`src/server/same-origin.ts`, unit-tested).
2. Browser-test timing: waits returned early because the previous page URL already matched. Fixed in the test with explicit navigation waits (not a product bug).

## 5. Known limitations (honest status)
- Sign-in and second factor are still **simulated** (`AUTH_MODE=dev`).
- **Media storage is local disk only.** Hosted media needs the Supabase Storage adapter and signed direct uploads (Vercel limits request bodies to 4.5 MB). Not built.
- **No automatic transcription** (no provider; ADR-007, R0). The author types transcripts. Theme suggestions are keyword rules, not AI.
- No virus/malware scanning of uploads (types are restricted and sniffed; files are never executed or served as active content).
- Not yet built: legacy-level deletion, guided prompts (module 05), still-image captions, audio duration, Range requests for seeking long recordings, storage orphan sweep (a failed file delete after a database delete leaves an unreachable file).
- Consent texts remain drafts ⚖. Effect of withdrawing audio consent on existing recordings (kept until the author deletes them) needs legal confirmation.
- Migration 0006 is **not yet applied to Supabase** (needs the connector switch, §0.3 of the handoff).

## 6. How to re-run
```bash
npm install
TEST_PG_URL="postgresql://postgres@localhost/postgres" npm test
DATABASE_URL=... npm run db:migrate && npm run build
DATABASE_URL=... AUTH_MODE=dev SESSION_SECRET=... STORAGE_DIR=/tmp/blobs npm start
python3 tests/e2e/walkthrough_slice2.py http://localhost:3000
python3 tests/e2e/walkthrough.py http://localhost:3000     # slice-1 regression
```
Raw outputs: `tests/results/e2e_walkthrough_slice2.json`, screenshots `07_memory_detail.png`, `08_memories_list.png`.
