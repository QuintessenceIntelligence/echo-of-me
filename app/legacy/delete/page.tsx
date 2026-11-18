import Link from "next/link";
import { redirect } from "next/navigation";
import { getOverview } from "../../../src/domain/onboarding";
import { listMemories } from "../../../src/domain/vault";
import { requireSession } from "../../../src/server/session";
import { Notices } from "../../components";
import { submitDeleteLegacy } from "../../vault-actions";

/** Permanent deletion of the whole legacy (AC-12). */
export default async function DeleteLegacyPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireSession("/legacy/delete");
  const o = await getOverview(ctx);
  if (!o.legacy) redirect("/home");
  const items = await listMemories(ctx, o.legacy.id);
  return (
    <>
      <p className="small"><Link href="/legacy">← {o.legacy.title}</Link></p>
      <h1>Delete this legacy</h1>
      <Notices searchParams={sp} />
      <div className="card">
        <p>This permanently deletes <strong>{o.legacy.title}</strong> and everything in it:</p>
        <ul>
          <li>{items.length} memor{items.length === 1 ? "y or value" : "ies and values"}, with every earlier version</li>
          <li>all recordings, photos and transcripts</li>
          <li>your {o.legacy.recipients.length} recipient{o.legacy.recipients.length === 1 ? "" : "s"}, their invitations and everything you shared with them</li>
          <li>your practice questions, answer rules and any reports</li>
        </ul>
        <p>It cannot be undone. People you shared with lose access immediately.</p>
        <p className="muted small">
          Kept: your consent history and the activity log, which record that this happened without any of your content.
          Your account stays, so you can start again.
        </p>
        <p><Link href="/legacy/export">Export everything first</Link> if you might want it later.</p>
      </div>
      <form action={submitDeleteLegacy} className="card">
        <input type="hidden" name="legacyId" value={o.legacy.id} />
        <label htmlFor="confirm-title">Type the title of your legacy to confirm: <strong>{o.legacy.title}</strong></label>
        <input id="confirm-title" name="confirmTitle" type="text" required autoComplete="off" />
        <label className="check"><input type="checkbox" name="understand" required /> I understand this permanently deletes my legacy and cannot be undone</label>
        <p className="muted small">Deleting needs your second sign-in step{ctx.aal === "aal2" ? " (confirmed for this session)" : ""}.</p>
        <div className="actions"><button type="submit" className="danger">Delete permanently</button></div>
      </form>
    </>
  );
}
