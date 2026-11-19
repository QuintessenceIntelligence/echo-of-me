# ADR-014: Hosted media storage through Supabase Storage's S3 protocol

| Field | Value |
|---|---|
| Status | ACCEPTED as the adapter design (routine technical decision, session 4). **Not yet verified against Supabase itself**: needs the founder's connector switch, a private bucket and storage access keys. No cost on the free plan; no new vendor (Supabase is already the database provider, DR-058). |
| Date | 19 November 2026 |
| Code | `src/server/storage.ts` (`S3BlobStore`, `storageBackend`), `.env.example` |
| Dependency | `aws4fetch` 1.0.20 (MIT, no dependencies): AWS Signature V4 signing for `fetch` |
| Tests | `tests/storage-s3.test.ts` against a local S3 emulator (moto 5.2.5): 7 tests incl. end-to-end vault upload, verified read, tamper detection and legacy deletion; 1 mutation check detected. Full suite 131/131. |

## Context
The local-disk store is refused on hosted deployments (Vercel's filesystem is not durable). Doc 03 listed a Supabase Storage adapter as a gap before the hosted preview. Two ways to reach Supabase Storage from the server:
1. The Storage REST API with the project's **service-role key**. That key also bypasses row-level security on the whole database through Supabase's data API, which would undo the least-privilege design (DR-057).
2. The **S3 protocol** with storage access keys generated in the Supabase dashboard. Supabase documents these as intended for server-side use only, with a path-style endpoint `https://<project_ref>.storage.supabase.co/storage/v1/s3` and the project's region [S1]. They are not database credentials; they do have broad access to all of the project's buckets and bypass Storage's own access rules [S2], which is acceptable because only the server holds them and every read is authorised by the database first.

## Decision
- Use the **S3 protocol** (option 2) with a private bucket, server-side only. The browser never receives storage credentials or object URLs; media is still served through the app's own `/media/<id>` route after the database has checked who may see it.
- Sign requests with `aws4fetch` rather than the full AWS SDK (smaller, auditable, no transitive dependencies).
- Keys remain server-generated `<legacy uuid>/<asset uuid>`; the adapter refuses any other shape before any network call, and when removing a legacy it deletes only listed keys of that exact shape under that legacy.
- Uploads send the body's SHA-256 (`x-amz-content-sha256`); the vault reads every upload back and compares, and checks the hash again on every read (unchanged from ADR-006).
- Selected only with `STORAGE_BACKEND=s3` **and** all five `STORAGE_S3_*` variables; anything incomplete is "unconfigured" and media features refuse to run instead of losing files.
- HTTPS required (plain HTTP only for `localhost` tests); error messages carry HTTP status codes only, never keys or secrets.

## Limits and follow-ups
- **Request size:** uploads pass through server actions, and hosting limits each request (doc 03 notes about 4.5 MB on Vercel). **Resolved by ADR-016** (files over 3 MB are sent in pieces and combined on the server).
- **Supabase specifics to verify on the real gateway:** path-style listing with continuation tokens, payload-hash checking, error codes, region string. The emulator is a stand-in, not proof.
- **Secrets:** the access key pair goes only into the hosting provider's encrypted environment variables; rotate if exposed. Generating it requires the founder (dashboard sign-in).
- **Encryption at rest and backups** of the bucket follow the provider's terms; to be recorded in the operator agreement (doc 05 §7, ⚖ L-05).

## Sources
- [S1] Supabase docs, "S3 Authentication" (endpoint, region, forcePathStyle; access keys for server-side use): https://supabase.com/docs/guides/storage/s3/authentication
- [S2] Directus docs, "Use Supabase Storage with Directus" (S3 keys are server-side only, have broad bucket access and bypass Storage RLS): https://directus.com/docs/guides/integrations/supabase/use-supabase-storage-with-directus
