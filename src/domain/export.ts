import { withActor } from "../server/db";
import { getBlobStore, sha256Hex } from "../server/storage";
import { buildZip, type ZipEntry } from "../server/zip";
import { audit, guarded } from "./audit";
import { requireMfa, type AuthContext } from "./auth";
import { EXTENSION, type AllowedMime } from "./media-type";
import { ownedLegacy } from "./onboarding";
import { IntegrityError, transcriptProvenance } from "./vault";

/**
 * Full export of a legacy in open formats (start of AC-12): one ZIP containing `legacy.json` (all text,
 * every version, approvals, provenance, tags, intended audience, consents and the activity log) and
 * every original recording or photo byte-for-byte, with its SHA-256 so anyone can check it (AC-03).
 * Needs a verified second factor, because it hands over everything at once.
 */
export const EXPORT_FORMAT = "echo-of-me-export/0.1";

export interface ExportResult {
  filename: string;
  zip: Buffer;
  manifest: ExportManifest;
}

export interface ExportManifest {
  format: string;
  exported_at: string;
  notice: string;
  legacy: Record<string, unknown>;
  recipients: Record<string, unknown>[];
  trusted_contacts: Record<string, unknown>[];
  memories: Record<string, unknown>[];
  answer_rules: Record<string, unknown>[];
  practice_questions: Record<string, unknown>[];
  reports_received: Record<string, unknown>[];
  consents: Record<string, unknown>[];
  activity_log: Record<string, unknown>[];
  files: { path: string; media_id: string; sha256: string; bytes: number; mime_type: string }[];
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

export async function exportLegacy(ctx: AuthContext, legacyId: string): Promise<ExportResult> {
  // Authorise (and audit a refusal) before reading anything.
  await guarded(ctx, "legacy.export", { legacyId, targetType: "legacy", targetId: legacyId }, async (db) => {
    requireMfa(ctx);
    await ownedLegacy(db, ctx, legacyId);
  });

  const data = await withActor(ctx.accountId, async (db) => {
    await ownedLegacy(db, ctx, legacyId);
    const q = async (sql: string, params: unknown[] = [legacyId]) => (await db.query(sql, params)).rows;
    const legacy = (await q("select id, title, author_display_name, about, state, created_at, updated_at from legacy where id = $1"))[0];
    const recipients = await q("select id, display_name, relationship, is_minor, email, invitation_status, created_at from recipient where legacy_id = $1 order by created_at");
    const trusted = await q("select id, display_name, email, relationship, created_at from trusted_contact where legacy_id = $1 order by created_at");
    const items = await q("select * from memory_item where legacy_id = $1 order by created_at, id");
    const versions = await q("select * from memory_version where legacy_id = $1 order by memory_id, version_no");
    const media = await q("select * from media_asset where legacy_id = $1 order by created_at, id");
    const transcripts = await q("select * from transcript where legacy_id = $1");
    const tversions = await q("select * from transcript_version where legacy_id = $1 order by media_asset_id, version_no");
    const tags = await q("select * from memory_tag where legacy_id = $1 order by memory_id, kind, lower(label)");
    const audience = await q("select memory_id, recipient_id from memory_audience where legacy_id = $1");
    const shares = await q("select memory_id, recipient_id, granted_at, sensitive_confirmed from share_grant where legacy_id = $1");
    const rules = await q("select action, question, memory_id, created_at from answer_rule where legacy_id = $1 order by created_at");
    const practice = await q("select question, kind, evidence, source_ids, created_at from rehearsal_turn where legacy_id = $1 order by created_at");
    const reports = await q("select reason, note, question, evidence, source_ids, created_at, resolved_at from answer_report where legacy_id = $1 order by created_at");
    const consents = await q(
      `select e.purpose, e.action, e.recorded_at, d.version, d.body_sha256, e.legacy_id
         from consent_event e join consent_document d on d.id = e.consent_document_id
        where e.account_id = $1 order by e.recorded_at`,
      [ctx.accountId],
    );
    const log = await q(
      `select occurred_at, action, outcome, target_type, target_id, (actor_account_id = $2) as by_you, detail
         from audit_event where legacy_id = $1 or (legacy_id is null and actor_account_id = $2) order by occurred_at`,
      [legacyId, ctx.accountId],
    );
    return { legacy, recipients, trusted, items, versions, media, transcripts, tversions, tags, audience, shares, rules, practice, reports, consents, log };
  });

  const store = getBlobStore();
  const entries: ZipEntry[] = [];
  const files: ExportManifest["files"] = [];
  for (const m of data.media) {
    const bytes = await store.get(m.storage_key).catch(() => Buffer.alloc(0));
    if (bytes.length !== Number(m.byte_size) || sha256Hex(bytes) !== m.sha256) throw new IntegrityError();
    const path = `echo-of-me-export/originals/${m.id}.${EXTENSION[m.mime_type as AllowedMime]}`;
    entries.push({ name: path, data: bytes, modified: new Date(m.created_at) });
    files.push({ path, media_id: m.id, sha256: m.sha256, bytes: bytes.length, mime_type: m.mime_type });
  }

  const memories = data.items.map((i) => ({
    id: i.id,
    kind: i.kind,
    approval: i.approval,
    approved_version: i.approved_version,
    approved_at: iso(i.approved_at),
    current_version: i.current_version,
    sensitivity: i.sensitivity,
    intended_for_recipient_ids: data.audience.filter((a) => a.memory_id === i.id).map((a) => a.recipient_id),
    shared_with: data.shares
      .filter((g) => g.memory_id === i.id)
      .map((g) => ({ recipient_id: g.recipient_id, shared_at: iso(g.granted_at), sensitive_confirmed: g.sensitive_confirmed })),
    created_at: iso(i.created_at),
    versions: data.versions
      .filter((v) => v.memory_id === i.id)
      .map((v) => ({ version: v.version_no, provenance: "P2_author_written", title: v.title, body: v.body, when: v.occurred_label, created_at: iso(v.created_at) })),
    media: data.media
      .filter((m) => m.memory_id === i.id)
      .map((m) => {
        const t = data.transcripts.find((x) => x.media_asset_id === m.id);
        return {
          id: m.id,
          kind: m.kind,
          provenance: "P1_original_recording",
          mime_type: m.mime_type,
          bytes: Number(m.byte_size),
          sha256: m.sha256,
          file: files.find((f) => f.media_id === m.id)!.path.replace("echo-of-me-export/", ""),
          original_filename: m.original_filename,
          capture: m.capture,
          created_at: iso(m.created_at),
          transcript: t
            ? {
                approval: t.approval,
                approved_at: iso(t.approved_at),
                current_version: t.current_version,
                provenance: transcriptProvenance(t.approval),
                versions: data.tversions
                  .filter((v) => v.media_asset_id === m.id)
                  .map((v) => ({ version: v.version_no, origin: v.origin, text: v.text, created_at: iso(v.created_at) })),
              }
            : null,
        };
      }),
    tags: data.tags
      .filter((t) => t.memory_id === i.id)
      .map((t) => ({
        kind: t.kind,
        label: t.label,
        origin: t.origin,
        state: t.state,
        provenance: t.origin === "automatic" && t.state !== "approved" ? "P6_unapproved_machine_output" : "author_decided",
      })),
  }));

  const exportedAt = new Date();
  const manifest: ExportManifest = {
    format: EXPORT_FORMAT,
    exported_at: exportedAt.toISOString(),
    notice:
      "Exported from Echo of Me (pre-release test version) by Quintessence Intelligence. Originals are byte-for-byte copies; " +
      "check them against the sha256 values. Provenance: P1 original recording, P2 your own words, P3 transcript you approved, " +
      "P6 unapproved machine output (never used in answers).",
    legacy: { ...data.legacy, created_at: iso(data.legacy.created_at), updated_at: iso(data.legacy.updated_at) },
    recipients: data.recipients.map((r) => ({ ...r, created_at: iso(r.created_at) })),
    trusted_contacts: data.trusted.map((t) => ({ ...t, created_at: iso(t.created_at) })),
    memories,
    answer_rules: data.rules.map((r) => ({ ...r, created_at: iso(r.created_at) })),
    practice_questions: data.practice.map((t) => ({ ...t, created_at: iso(t.created_at) })),
    reports_received: data.reports.map((r) => ({ ...r, created_at: iso(r.created_at), resolved_at: iso(r.resolved_at) })),
    consents: data.consents.map((c) => ({ ...c, recorded_at: iso(c.recorded_at) })),
    activity_log: data.log.map((l) => ({ ...l, occurred_at: iso(l.occurred_at) })),
    files,
  };

  const readme = [
    "Echo of Me export",
    "=================",
    "",
    `Format: ${EXPORT_FORMAT}`,
    `Exported: ${manifest.exported_at}`,
    "",
    "legacy.json   Everything you wrote, every version, approvals, tags, who each item is shared with,",
    "              your answer rules and practice questions, reports from recipients, consents and the activity log.",
    "              (Recipients' own questions are theirs and are not included.)",
    "originals/    Your recordings and photos exactly as you made them. Check them with: sha256sum originals/*",
    "SHA256SUMS    The expected fingerprint of each original.",
    "",
  ].join("\n");

  entries.unshift(
    { name: "echo-of-me-export/README.txt", data: Buffer.from(readme, "utf8"), modified: exportedAt },
    { name: "echo-of-me-export/legacy.json", data: Buffer.from(JSON.stringify(manifest, null, 2), "utf8"), modified: exportedAt },
    {
      name: "echo-of-me-export/SHA256SUMS",
      data: Buffer.from(files.map((f) => `${f.sha256}  ${f.path.replace("echo-of-me-export/", "")}`).join("\n") + (files.length ? "\n" : ""), "utf8"),
      modified: exportedAt,
    },
  );
  const zip = buildZip(entries);

  await withActor(ctx.accountId, (db) =>
    audit(db, ctx, {
      action: "legacy.export",
      legacyId,
      targetType: "legacy",
      targetId: legacyId,
      detail: { memories: memories.length, files: files.length, bytes: zip.length },
    }),
  );
  const stamp = exportedAt.toISOString().slice(0, 10);
  return { filename: `echo-of-me-export-${stamp}.zip`, zip, manifest };
}
