"use client";

import Link from "next/link";
import { useActionState } from "react";
import { rehearseAction, type RehearseState } from "../../vault-actions";

const EVIDENCE: Record<string, { label: string; cls: string; help: string }> = {
  E1: { label: "In their own words", cls: "ev e1", help: "Quoted directly from something they recorded and approved." },
  E2: { label: "Related, not a direct answer", cls: "ev e2", help: "Nothing answers this directly. These approved items share its topic." },
  E3: { label: "Not recorded", cls: "ev e3", help: "Nothing they approved covers this. Nothing was invented." },
};

const PROV: Record<string, string> = {
  P1_original_recording: "Original recording",
  P2_author_written: "Their own words",
  P3_approved_transcript: "Transcript they approved",
};

const dateFmt = (iso: string) => new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "Africa/Johannesburg" }).format(new Date(iso));

export function Rehearse({ legacyId, authorName }: { legacyId: string; authorName: string }) {
  const [state, action, pending] = useActionState<RehearseState, FormData>(rehearseAction, {});
  const a = state.answer;
  return (
    <>
      <form action={action} className="card">
        <input type="hidden" name="legacyId" value={legacyId} />
        <label htmlFor="q">Ask a question the way someone you love might ask it one day</label>
        <textarea id="q" name="question" rows={2} maxLength={500} required defaultValue={state.question ?? ""} placeholder="For example: What did you learn from failing?" />
        <div className="actions"><button type="submit" disabled={pending}>{pending ? "Looking…" : "Ask"}</button></div>
      </form>

      {state.error && <p className="notice error" role="alert">{state.error}</p>}

      {a && (
        <section className="card answer" aria-labelledby="answer-h" aria-live="polite">
          <p className="disclosure small">{a.disclosure}</p>
          <h2 id="answer-h">
            Answer{" "}
            {a.evidence && <span className={EVIDENCE[a.evidence].cls} title={EVIDENCE[a.evidence].help}>{EVIDENCE[a.evidence].label} · {a.evidence}</span>}
            {a.kind === "identity" && <span className="ev e3">About this interface</span>}
            {a.kind === "safety" && <span className="ev safety">Please talk to a person</span>}
          </h2>
          {a.evidence && <p className="muted small">{EVIDENCE[a.evidence].help}</p>}
          <p className="lead">{a.lead}</p>

          {a.resources.length > 0 && (
            <ul className="resources">
              {a.resources.map((r) => <li key={r.name}><strong>{r.name}:</strong> {r.contact} <span className="muted small">{r.note}</span></li>)}
            </ul>
          )}

          {a.passages.map((p) => (
            <div key={p.sourceId} className="source-card">
              {p.quote !== null ? (
                <blockquote>{p.truncated && "… "}{p.quote}{p.truncated && " …"}</blockquote>
              ) : (
                <audio controls preload="none" src={`/media/${p.mediaAssetId}`} aria-label={`Original recording: ${p.title}`} />
              )}
              <div className="small muted">
                <span className={p.provenance === "P1_original_recording" ? "prov p1" : p.provenance === "P3_approved_transcript" ? "prov p3" : "prov p2"}>{PROV[p.provenance] ?? p.provenance}</span>{" "}
                <Link href={`/legacy/memories/${p.memoryId}`}>{p.title}</Link>
                {p.versionNo ? ` · version ${p.versionNo}` : ""} · approved {dateFmt(p.approvedAt)}
                {p.sensitive && <> · <span className="pill warn">Sensitive</span></>}
              </div>
            </div>
          ))}

          {a.adjacent.length > 0 && (
            <>
              <h3>Things {authorName} did record</h3>
              <ul>{a.adjacent.map((x) => <li key={x.memoryId}><Link href={`/legacy/memories/${x.memoryId}`}>{x.title}</Link></li>)}</ul>
            </>
          )}
          {a.kind === "not_recorded" && (
            <p className="notice info small">This is a gap you could fill: <Link href="/legacy/memories#add">record something about it</Link>.</p>
          )}
        </section>
      )}
    </>
  );
}
