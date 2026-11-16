# ADR-006 Memory capture and provenance (vertical slice 2)

| Field | Value |
|---|---|
| Status | **Accepted** (technical decision under DR-051; no product scope changed) |
| Date | 17 November 2026 |
| Implements | Module 02 (Memory & Wisdom Vault) capture part; 01B §4.3 provenance P1–P6; 01B §4.5 ingestion; AC-03, AC-04, start of AC-05 and AC-12 |
| Code | `db/migrations/0006_memory_capture_and_provenance.sql`, `src/domain/vault.ts`, `src/domain/export.ts`, `src/server/storage.ts`, `src/server/zip.ts`, `src/domain/media-type.ts`, `src/domain/suggest.ts` |

## Decisions

1. **Item + append-only versions.** `memory_item` (memory or value statement) holds state; `memory_version` holds the words. An edit inserts a version; versions cannot be updated (grant + trigger, even for the owner) and are only removed with their item.
2. **Approval is per exact version.** An item is citable only while `approval = 'approved'` and `approved_version = current_version` (database check). Any change to words or recordings returns it to draft in the same transaction, so a superseded wording can never be cited (AC-05 rule; the ≤5 min index window becomes relevant only when slice 3 adds an index).
3. **Provenance is derived, not typed in.** Author text = P2; original media = P1; transcript approved by the author = P3; unapproved transcript or automatic suggestion = P6. P4 (approved AI derivation) and P5 (contributor) are reserved.
4. **Retrieval boundary is a view.** `citable_source` (security-invoker) lists approved P1/P2/P3 material only. Slice 3 must read from this view and nothing else, which makes AC-04 structural rather than a coding convention.
5. **Originals are immutable and verified.** `media_asset` rows cannot be updated; the bytes live in a blob store under a server-generated key `<legacy>/<asset>`; SHA-256 and size are stored, the blob is read back after writing, and every read and export re-verifies it (AC-03). File type is decided from the bytes; SVG, video and unknown types are refused. Limits: audio 25 MB, photo 10 MB, 250 MB per legacy (R0 protection).
6. **Storage adapter.** `LocalBlobStore` for development and tests; **refused on any hosted deployment** (same rule as the development sign-in). A Supabase Storage adapter (private bucket, server-side only, signed direct uploads because Vercel caps request bodies at 4.5 MB) is the next storage step and is not built yet.
7. **Composite keys stop cross-legacy links.** Every child row carries `legacy_id` with a foreign key on `(id, legacy_id)`, so even the owner of two legacies cannot attach a recording, version or intended recipient across them.
8. **Intended audience grants nothing.** `memory_audience` records who an item is for; recipients still have no table access (AC-02). Sharing is slice 5.
9. **Automatic suggestions without AI.** Theme suggestions come from a small local keyword list (no third party, no cost, DR-054). They need the `ai_processing` consent because its text covers automatic tagging, are stored as P6 and wait for the author. Withdrawing that consent deletes pending suggestions; the author's decisions stay. Machine transcription has an entry point (`recordMachineTranscript`) but no provider until ADR-007.
10. **Audio needs the `audio_recording` consent.** Withdrawing it stops new recordings; existing recordings are kept until the author deletes them (⚖ to confirm in legal review; see open items).
11. **Export.** One ZIP (own minimal writer, stored entries so bytes are untouched): `legacy.json` (format `echo-of-me-export/0.1`: every version, approvals, provenance, tags, audience, consents, activity log), `originals/`, `SHA256SUMS`. Needs a verified second factor; audited. Delete of an item also needs MFA.

## Consequences
- Slice 3 has a single, tested source of citable material.
- Hosting media needs the Supabase Storage adapter first; until then the hosted preview can show text capture only.
- Legacy-level deletion (rest of AC-12) and deletion propagation to derived indexes arrive with slices 3 and 6.
