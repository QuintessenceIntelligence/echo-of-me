import Link from "next/link";
import { redirect } from "next/navigation";
import { getOverview } from "../../../src/domain/onboarding";
import { listMemories } from "../../../src/domain/vault";
import { requireSession } from "../../../src/server/session";
import { formatDateTime, Notices } from "../../components";
import { submitCreateMemory } from "../../vault-actions";
import { ApprovalPill, KIND_LABEL } from "./ui";

export default async function Memories({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireSession("/legacy/memories");
  const o = await getOverview(ctx);
  if (!o.legacy) redirect("/home");
  const items = await listMemories(ctx, o.legacy.id);
  const approved = items.filter((i) => i.approval === "approved").length;

  return (
    <>
      <p className="small"><Link href="/legacy">← {o.legacy.title}</Link></p>
      <h1>Memories and values</h1>
      <p className="muted">
        Write or record what you want to preserve. Everything starts as a draft. Only items you approve can ever be
        used to answer questions, and the AI part of Echo of Me is not switched on yet.
      </p>
      <Notices searchParams={sp} />

      <section className="card" aria-labelledby="list-h">
        <h2 id="list-h">Your items <span className="muted small">({items.length} · {approved} approved)</span></h2>
        {items.length === 0 ? (
          <p className="muted">Nothing yet. Add your first memory or value below.</p>
        ) : (
          <ul className="item-list">
            {items.map((i) => (
              <li key={i.id}>
                <Link href={`/legacy/memories/${i.id}`} className="item-title">{i.title}</Link>
                <div className="item-meta small">
                  <span className="pill">{KIND_LABEL[i.kind]}</span>
                  <ApprovalPill approval={i.approval} />
                  {i.sensitivity === "sensitive" && <span className="pill warn">Sensitive</span>}
                  {i.mediaCount > 0 && <span className="pill">{i.mediaCount} recording{i.mediaCount === 1 ? "" : "s"} or photo{i.mediaCount === 1 ? "" : "s"}</span>}
                  {i.pendingSuggestions > 0 && <span className="pill warn">{i.pendingSuggestions} suggestion{i.pendingSuggestions === 1 ? "" : "s"} to review</span>}
                  {i.occurredLabel && <span className="muted">{i.occurredLabel}</span>}
                  <span className="muted">Version {i.currentVersion} · {formatDateTime(i.updatedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" id="add" aria-labelledby="add-h">
        <h2 id="add-h">Add something</h2>
        <form action={submitCreateMemory}>
          <input type="hidden" name="legacyId" value={o.legacy.id} />
          <fieldset className="plain">
            <legend>What are you adding?</legend>
            <label className="check"><input type="radio" name="kind" value="memory" defaultChecked /> A memory or story</label>
            <label className="check"><input type="radio" name="kind" value="value_statement" /> A value or belief you hold</label>
          </fieldset>
          <label htmlFor="m-title">Title</label>
          <input id="m-title" name="title" type="text" required maxLength={160} placeholder="For example: The day I failed my driving test" />
          <label htmlFor="m-when">When did this happen? (optional)</label>
          <input id="m-when" name="occurredLabel" type="text" maxLength={80} placeholder="For example: 1998, or when you were born" />
          <label htmlFor="m-body">In your own words</label>
          <textarea id="m-body" name="body" maxLength={20000} rows={7} />
          <p className="muted small">You can also leave this empty, save a draft and add a voice recording on the next page.</p>
          <label className="check"><input type="checkbox" name="sensitive" /> This is sensitive (handle with extra care)</label>
          <div className="actions">
            <button type="submit" name="intent" value="draft" className="secondary">Save as draft</button>
            <button type="submit" name="intent" value="approve">Save and approve</button>
          </div>
        </form>
      </section>
    </>
  );
}
