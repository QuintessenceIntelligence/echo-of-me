"use client";

import { useActionState } from "react";
import { AnswerView } from "../../ui/AnswerView";
import { recipientAction, type RecipientAskState } from "../../vault-actions";

const REASONS: [string, string][] = [
  ["not_what_they_meant", "This is not what they meant"],
  ["wrong_or_outdated", "This is wrong or out of date"],
  ["upsetting", "This upset me"],
  ["other", "Something else"],
];

/** A recipient asks about what was shared with them, and can tell the author when an answer is wrong. */
export function RecipientAsk({ legacyId, authorName }: { legacyId: string; authorName: string }) {
  const [state, action, pending] = useActionState<RecipientAskState, FormData>(recipientAction, {});
  const a = state.answer;
  const reported = a ? (state.reported ?? []).includes(a.turnId) : false;
  return (
    <>
      <form action={action} className="card">
        <input type="hidden" name="legacyId" value={legacyId} />
        <input type="hidden" name="op" value="ask" />
        <label htmlFor="rq">Ask about what {authorName} shared with you</label>
        <textarea id="rq" name="question" rows={2} maxLength={500} required key={state.question ?? ""} defaultValue={state.question ?? ""} />
        <p className="muted small">Answers only quote what {authorName} recorded, approved and shared with you, or say that nothing was recorded. Your questions are private to you.</p>
        <div className="actions"><button type="submit" disabled={pending}>{pending ? "Looking…" : "Ask"}</button></div>
      </form>
      {state.error && <p className="notice error" role="alert">{state.error}</p>}
      {state.notice && <p className="notice ok" role="status">{state.notice}</p>}
      {a && (
        <AnswerView answer={a} authorName={authorName} sourceHref={(id) => `#item-${id}`} pinnedLabel={`${authorName} chose this answer on`}>
          {(a.kind === "grounded" || a.kind === "not_recorded") && !reported && (
            <details className="own-answer">
              <summary>Tell {authorName} about this answer</summary>
              <form action={action}>
                <input type="hidden" name="legacyId" value={legacyId} />
                <input type="hidden" name="op" value="report" />
                <input type="hidden" name="turnId" value={a.turnId} />
                <fieldset className="plain">
                  <legend>What is wrong?</legend>
                  {REASONS.map(([v, label], i) => (
                    <label className="check" key={v}><input type="radio" name="reason" value={v} defaultChecked={i === 0} /> {label}</label>
                  ))}
                </fieldset>
                <label htmlFor="r-note">Anything you want to add (optional)</label>
                <textarea id="r-note" name="note" rows={2} maxLength={500} />
                <label className="check"><input type="checkbox" name="includeQuestion" /> Include my question so {authorName} can see what I asked</label>
                <div className="actions"><button type="submit" className="secondary" disabled={pending}>Send to {authorName}</button></div>
              </form>
            </details>
          )}
        </AnswerView>
      )}
    </>
  );
}
