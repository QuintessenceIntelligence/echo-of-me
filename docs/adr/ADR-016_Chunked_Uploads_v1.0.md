# ADR-016: Chunked uploads for recordings and photos larger than one request

| Field | Value |
|---|---|
| Status | ACCEPTED (routine technical decision, session 4; no vendor, no cost) |
| Date | 19 November 2026 |
| Migration | `db/migrations/0015_upload_staging.sql` |
| Code | `src/domain/uploads.ts`; `storeMedia` split out of `addMedia` in `src/domain/vault.ts`; server actions in `app/vault-actions.ts`; client in `app/legacy/memories/[id]/MediaCapture.tsx` |
| Tests | `tests/uploads.test.ts` (5); browser `tests/e2e/walkthrough_uploads.py` (7.2 MB file, stored byte for byte; 0 axe). Full suite 150/150; all walkthroughs 121/121. |

## Context
Hosting limits each request body (doc 03 and ADR-014 note about 4.5 MB on Vercel), but the product allows recordings up to 25 MB and photos up to 10 MB. ADR-014 listed "direct signed uploads" as the fix. On review, browser-to-storage uploads depend on CORS support in Supabase's S3 gateway, which cannot be verified yet, and would put a second origin into the strict CSP.

## Decision
- Files larger than **3 MB** are sent from the browser in **3 MB pieces** to server actions. Smaller files use the existing single upload.
- Pieces wait in `upload_chunk`, private to the legacy's author by row-level security, linked to an `upload_session` that records the expected size and piece size. Each piece must have exactly the expected length and position; sending a piece twice is harmless (retries).
- **Finishing** combines the pieces and passes the whole file to `storeMedia`, the same function behind single uploads: type from the bytes, audio consent, legacy quota, byte-identical storage with SHA-256 read-back. The pieces are deleted whether or not the file is accepted; nothing is visible anywhere until it is.
- **Limits:** one rate-limit attempt per upload (at start), at most 3 unfinished uploads per legacy, unfinished uploads expire after one hour, declared size at most 25 MB.
- Works the same with local and S3 storage, so it is fully testable locally and needs no storage-provider feature.
- Also: the author's recordings now load only when played (`preload="none"`), as on the recipient page, which saves data on phones.

## Consequences
- Pieces sit in the database for up to an hour (at most 3 × 25 MB per legacy). On the free plan this is acceptable for a preview; a scheduled clean-up can be added if needed.
- Upload progress is shown as a percentage; one retry per piece on a dropped connection.

## Alternatives considered
- Direct browser upload to storage with presigned URLs: fewer server round trips, but depends on unverified CORS behaviour and widens the CSP. Can be revisited after the hosted preview.
- Multipart upload to S3 from the server: S3 multipart requires parts of at least 5 MB except the last, which does not fit under the request limit.
