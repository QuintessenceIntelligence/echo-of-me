"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Answer, Passage } from "../../src/domain/rehearsal";

/**
 * One way of showing an answer everywhere (author practice and recipients): the AI disclosure first, the
 * evidence label, the author's verbatim words with their source, or a plain "not recorded" (AC-06, AC-09).
 */
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

export function AnswerView({
  answer: a,
  authorName,
  sourceHref,
  passageActions,
  adjacentAction,
  pinnedLabel = "You pinned this answer on",
  children,
}: {
  answer: Answer;
  authorName: string;
  /** Where a source title links to (author: the item page; recipient: the item on the shared page). */
  sourceHref: (memoryId: string) => string;
  passageActions?: (p: Passage) => ReactNode;
  adjacentAction?: (x: Answer["adjacent"][number]) => ReactNode;
  pinnedLabel?: string;
  children?: ReactNode;
}) {
  return (
    <section className="card answer" aria-labelledby="answer-h" aria-live="polite">
      <p className="disclosure small">{a.disclosure}</p>
      <h2 id="answer-h">
        Answer{" "}
        {a.evidence && <span className={EVIDENCE[a.evidence].cls} title={EVIDENCE[a.evidence].help}>{EVIDENCE[a.evidence].label} · {a.evidence}</span>}
        {a.kind === "identity" && <span className="ev e3">About this interface</span>}
        {a.kind === "safety" && <span className="ev safety">Please talk to a person</span>}
      </h2>
      {a.evidence && <p className="muted small">{EVIDENCE[a.evidence].help}</p>}
      {a.rules.pinnedAt && <p className="pill good small">{pinnedLabel} {dateFmt(a.rules.pinnedAt)}</p>}
      {a.rules.suppressed > 0 && passageActions && <p className="muted small">{a.rules.suppressed} item{a.rules.suppressed === 1 ? " is" : "s are"} hidden for this question by your rules.</p>}
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
            <Link href={sourceHref(p.memoryId)}>{p.title}</Link>
            {p.versionNo ? ` · version ${p.versionNo}` : ""} · approved {dateFmt(p.approvedAt)}
            {p.sensitive && <> · <span className="pill warn">Sensitive</span></>}
          </div>
          {passageActions?.(p)}
        </div>
      ))}

      {a.adjacent.length > 0 && (
        <>
          <h3>Things {authorName} did record</h3>
          <ul className="adjacent">
            {a.adjacent.map((x) => (
              <li key={x.memoryId}>
                <Link href={sourceHref(x.memoryId)}>{x.title}</Link>
                {adjacentAction && <> {adjacentAction(x)}</>}
              </li>
            ))}
          </ul>
        </>
      )}
      {children}
    </section>
  );
}
