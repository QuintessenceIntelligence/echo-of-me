"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AnswerView } from "../../ui/AnswerView";
import { rehearseAction, type RehearseState } from "../../vault-actions";

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
        <AnswerView
          answer={a}
          authorName={authorName}
          sourceHref={(id) => `/legacy/memories/${id}`}
          passageActions={(p) =>
            a.teachable && p.sourceType !== "media_asset" ? (
              <div className="teach small">
                {!a.rules.pinnedAt && teach("pin", { memoryId: p.memoryId }, "This is the answer: pin it", "link small", `Pin “${p.title}” as the answer to this question`)}
                {teach("suppress", { memoryId: p.memoryId }, "Don't use this for this question", "link small", `Don't use “${p.title}” for this question`)}
              </div>
            ) : null
          }
          adjacentAction={(x) => (a.teachable ? teach("pin", { memoryId: x.memoryId }, "Pin as the answer", "link small", `Pin “${x.title}” as the answer to this question`) : null)}
        >
          {a.kind === "not_recorded" && (
            <p className="notice info small">This is a gap you could fill: answer it yourself below, or <Link href="/legacy/memories#add">record something about it</Link>.</p>
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
        </AnswerView>
      )}
    </>
  );
}
