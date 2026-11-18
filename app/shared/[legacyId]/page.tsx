import Link from "next/link";
import { redirect } from "next/navigation";
import { DomainError } from "../../../src/domain/errors";
import { listSharedItems, type SharedLegacy } from "../../../src/domain/sharing";
import { requireSession } from "../../../src/server/session";
import { formatDateTime } from "../../components";
import { RecipientAsk } from "./RecipientAsk";

/** What a recipient sees: only items the author approved and shared with them, and a way to ask. */
export default async function SharedPage({ params }: { params: Promise<{ legacyId: string }> }) {
  const { legacyId } = await params;
  const ctx = await requireSession(`/shared/${legacyId}`);
  let s: SharedLegacy;
  try {
    s = await listSharedItems(ctx, legacyId);
  } catch (err) {
    if (err instanceof DomainError) redirect(`/home?error=${encodeURIComponent("That legacy is not available to you.")}`);
    throw err;
  }
  return (
    <>
      <p className="small"><Link href="/home">← Home</Link></p>
      <h1>{s.legacyTitle}</h1>
      <p className="muted">From {s.authorDisplayName}</p>
      <p className="disclosure">
        Everything here was recorded and approved by {s.authorDisplayName} and shared with you. Answers to questions are given by Echo of Me,
        an AI interface: it is not {s.authorDisplayName}, and it only shows their own words.
      </p>

      {s.items.length === 0 ? (
        <div className="card"><p>Nothing has been shared with you yet. You will see items here only when {s.authorDisplayName} chooses to share them with you.</p></div>
      ) : (
        <>
          {s.answersOn ? (
            <RecipientAsk legacyId={s.legacyId} authorName={s.authorDisplayName} />
          ) : (
            <p className="notice info small">{s.authorDisplayName} has not switched on answers to questions. You can read everything shared with you below.</p>
          )}
          <section aria-labelledby="items-h">
            <h2 id="items-h">Shared with you ({s.items.length})</h2>
            {s.items.map((it) => (
              <article className="card" id={`item-${it.memoryId}`} key={it.memoryId} aria-labelledby={`t-${it.memoryId}`}>
                <h3 id={`t-${it.memoryId}`}>{it.title}</h3>
                <p className="muted small">
                  {it.kind === "value_statement" ? "A value" : "A memory"}
                  {it.occurredLabel ? ` · ${it.occurredLabel}` : ""} · approved {formatDateTime(it.approvedAt)}
                </p>
                {it.body && <div className="memory-body">{it.body}</div>}
                {it.media.map((m, i) => (
                  <div key={m.id} className="media-item">
                    {m.kind === "audio" ? (
                      <audio controls preload="none" src={`/media/${m.id}`} aria-label={`${s.authorDisplayName}'s original recording ${i + 1} for “${it.title}”`} />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/media/${m.id}`} alt={`Photo ${i + 1} shared with “${it.title}”`} className="media-photo" />
                    )}
                    {m.transcript && <details><summary>Transcript {s.authorDisplayName} approved</summary><div className="memory-body small">{m.transcript}</div></details>}
                  </div>
                ))}
              </article>
            ))}
          </section>
        </>
      )}
    </>
  );
}
