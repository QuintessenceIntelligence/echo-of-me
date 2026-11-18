import { getBlobStore } from "../server/storage";
import { audit, guarded } from "./audit";
import { requireMfa, type AuthContext } from "./auth";
import { ValidationError } from "./errors";
import { ownedLegacy } from "./onboarding";

/**
 * Permanent deletion of a whole legacy (AC-12). Needs a verified second factor and the legacy's exact title
 * typed by the author. In one transaction the legacy row is deleted and the database cascades to every item,
 * version, recording, transcript, tag, rule, share, recipient, invitation, trusted contact, practice question,
 * recipient question and report. There are no separate search indexes to clean (search reads the citable view
 * at query time), so nothing derived survives. Then the stored files are removed.
 *
 * Kept on purpose: the consent history and the activity log (no foreign key; identifiers and counts only,
 * never content), so the deletion itself remains accountable. Retention of those records is a POPIA question
 * for doc 05 ⚖.
 */
export async function deleteLegacy(ctx: AuthContext, legacyId: string, confirmTitle: string): Promise<{ items: number; files: number }> {
  const result = await guarded(ctx, "legacy.delete", { legacyId, targetType: "legacy", targetId: legacyId }, async (db) => {
    requireMfa(ctx);
    const l = await ownedLegacy(db, ctx, legacyId);
    const title = (await db.query("select title from legacy where id = $1", [l.id])).rows[0].title as string;
    if (typeof confirmTitle !== "string" || confirmTitle.trim() !== title) {
      throw new ValidationError("Please type the title of your legacy exactly to confirm.");
    }
    const counts = (await db.query(
      `select (select count(*)::int from memory_item where legacy_id = $1) as items,
              (select count(*)::int from recipient where legacy_id = $1) as recipients,
              (select count(*)::int from media_asset where legacy_id = $1) as files`,
      [legacyId],
    )).rows[0];
    const keys = (await db.query("select storage_key from media_asset where legacy_id = $1", [legacyId])).rows.map((r) => r.storage_key as string);
    await db.query("delete from legacy where id = $1", [legacyId]);
    await audit(db, ctx, {
      action: "legacy.delete",
      legacyId,
      targetType: "legacy",
      targetId: legacyId,
      detail: { items: counts.items, recipients: counts.recipients, files: counts.files },
    });
    return { items: counts.items as number, files: counts.files as number, keys };
  });
  const store = getBlobStore();
  for (const k of result.keys) await store.delete(k).catch((err) => console.error("blob delete failed", k, err));
  await store.removeLegacy(legacyId).catch((err) => console.error("legacy folder delete failed", legacyId, err));
  return { items: result.items, files: result.files };
}
