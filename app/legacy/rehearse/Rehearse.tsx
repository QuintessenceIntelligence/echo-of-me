"use client";

import Link from "next/link";
import { useActionState } from "react";
import { rehearseAction, type RehearseState } from "../../vault-actions";

const EVIDENCE: Record<string, { label: string; cls: string; help: string }> = {
  E1: { label: "In their own words", cls: "ev e1", help: "Quoted directly from something they recorded and approved." },
  E2: { label: "Related, not a direct answer", cls: "ev e2", help: "Nothing answers this directly. These approved items share its topic." },
  E3: { label: "Not recorded", cls: "ev e3", help: "Nothing they approved covers this. Nothing was invented." },
};

const PROV: Record<string, { label: string; cls: string }> = {
  P1_original_recording: { label: "Original recording", cls: "prov p1" },
  P2_author_written: { label: "Their own words", cls: "prov p2" },
  P3_approved_transcript: { label: "Transcript they approved", cls: "prov p3" },
};

const dateFmt = (iso: string) => new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "Africa/Johannesburg" }).format(new Date(iso));

export function Rehearse({ legacyId, authorName }: { legacyId: string; authorName: string }) {
  const [state, action, pending] = useActionState<RehearseState, FormData>(rehearseAction, {});
  const a = state.answer;
  const teach = (op: string, extra: Record<string, string>, label: string, cls = "link small", aria?: string) => (
    <form action={action} className="inline">
      <input type="hidden" name="legacyId" value={legacyId} />
      <input type="hidden" name="op" value={op} />
      <input type="hidden" name="turnId" value={a?.turnId ?? ""} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button type="submit" className={cls} disabled={pending} aria-label={aria}>{label}</button>
    </form>
  );
  return (
    <>
      <form action={action} className="card">
        <input type="hidden" name="legacyId" value={legacyId} />
        <input type="hidden" name="op" value="ask" />
        <label htmlFor="q">Ask a question the way someone you love might ask it one day</label>
        <textarea id="q" name="question" rows={2} maxLength={500} required key={state.question ?? ""} defaultValue={state.question ?? ""} placeholder="For example: What did you learn from failing?" />
        <div className="actions"><button type="submit" disabled={pending}>{pending ? "Looking…" : "Ask"}</button></div>
      </form>

      {state.error && <p className="notice error" role="alert">{state.error}</p>}
      {state.notice && <p className="notice ok" role="status">{state.notice}</p>}

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
          {a.rules.pinnedAt && <p className="pill good small">You pinned this answer on {dateFmt(a.rules.pinnedAt)}</p>}
          {a.rules.suppressed > 0 && <p className="muted small">{a.rules.suppressed} item{a.rules.suppressed === 1 ? " is" : "s are"} hidden for this question by your rules.</p>}
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
                <span className={PROV[p.provenance]?.cls ?? "prov"}>{PROV[p.provenance]?.label ?? p.provenance}</span>{" "}
                <Link href={`/legacy/memories/${p.memoryId}`}>{p.title}</Link>
                {p.versionNo ? ` · version ${p.versionNo}` : ""} · approved {dateFmt(p.approvedAt)}
                {p.sensitive && <> · <span className="pill warn">Sensitive</span></>}
              </div>
              {a.teachable && p.sourceType !== "media_asset" && (
                <div className="teach small">
                  {!a.rules.pinnedAt && teach("pin", { memoryId: p.memoryId }, "This is the answer: pin it", "link small", `Pin “${p.title}” as the answer to this question`)}
                  {teach("suppress", { memoryId: p.memoryId }, "Don't use this for this question", "link small", `Don't use “${p.title}” for this question`)}
                </div>
              )}
            </div>
          ))}

          {a.adjacent.length > 0 && (
            <>
              <h3>Things {authorName} did record</h3>
              <ul className="adjacent">
                {a.adjacent.map((x) => (
                  <li key={x.memoryId}>
                    <Link href={`/legacy/memories/${x.memoryId}`}>{x.title}</Link>
                    {a.teachable && <> {teach("pin", { memoryId: x.memoryId }, "Pin as the answer", "link small", `Pin “${x.title}” as the answer to this question`)}</>}
                  </li>
                ))}
              </ul>
            </>
          )}

          {a.teachable && (
            <details className="own-answer">
              <summary>Answer it yourself</summary>
              <form action={action}>
                <input type="hidden" name="legacyId" value={legacyId} />
                <input type="hidden" name="op" value="own" />
                <input type="hidden" name="turnId" value={a.turnId} />
                <p className="muted small">Write what you would say. It is saved as a new approved item in your own words, titled with this question, and pinned as its answer.</p>
                <label htmlFor="own-body">Your answer</label>
                <textarea id="own-body" name="body" rows={4} maxLength={20000} required />
                <fieldset className="plain">
                  <legend>Save it as</legend>
                  <label className="check"><input type="radio" name="kind" value="value_statement" defaultChecked /> A value or belief</label>
                  <label className="check"><input type="radio" name="kind" value="memory" /> A memory or story</label>
                </fieldset>
                <div className="actions"><button type="submit" disabled={pending}>Save, approve and pin</button></div>
              </form>
            </details>
          )}
        </section>
      )}
    </>
  );
}
