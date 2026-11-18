import Link from "next/link";
import { redirect } from "next/navigation";
import { getOverview } from "../../../src/domain/onboarding";
import { listAnswerRules, rehearsalHistory } from "../../../src/domain/rehearsal";
import { requireSession } from "../../../src/server/session";
import { formatDateTime, Notices } from "../../components";
import { submitClearRehearsal, submitRemoveRule } from "../../vault-actions";
import { Rehearse } from "./Rehearse";

const KIND: Record<string, string> = {
  grounded: "Answered from approved material",
  not_recorded: "Not recorded",
  identity: "Question about the interface",
  safety: "Safety message shown (question not stored)",
  empty_question: "No topic found",
};

/** Module 04, author rehearsal: see how questions would be answered from approved material only. */
export default async function RehearsePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireSession("/legacy/rehearse");
  const o = await getOverview(ctx);
  if (!o.legacy) redirect("/home");
  const allowed = o.consents.find((c) => c.purpose === "ai_processing")?.state === "granted";
  const history = allowed ? await rehearsalHistory(ctx, o.legacy.id) : [];
  const rules = allowed ? await listAnswerRules(ctx, o.legacy.id) : [];
  return (
    <>
      <p className="small"><Link href="/legacy">← {o.legacy.title}</Link></p>
      <h1>Practise questions</h1>
      <p className="muted">
        Ask what your family might ask one day and see exactly how Echo of Me would answer: only with words you approved,
        always showing where they come from, and saying plainly when you have not recorded something. Nothing here is shown to anyone else.
      </p>
      <p className="notice info small">
        In this test version answers are put together without an AI model: Echo of Me finds your approved items that share the question’s
        topic words and quotes them exactly. It can miss things you said in different words. It never invents an answer.
      </p>
      <Notices searchParams={sp} />
      {allowed ? (
        <>
          <Rehearse legacyId={o.legacy.id} authorName={o.legacy.authorDisplayName} />
          {rules.length > 0 && (
            <section className="card" id="rules" aria-labelledby="rules-h">
              <h2 id="rules-h">Your answer rules</h2>
              <p className="muted small">Rules apply to questions with the same topic words. A pinned item that you return to draft stops being used until you approve it again.</p>
              <table>
                <thead><tr><th>Question</th><th>Rule</th><th><span className="visually-hidden">Remove</span></th></tr></thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td>{r.question}</td>
                      <td className="small">
                        {r.action === "pin" ? "Answer with " : "Never use "}
                        <Link href={`/legacy/memories/${r.memoryId}`}>{r.title}</Link>
                        {!r.active && <span className="muted"> (inactive: item is a draft)</span>}
                      </td>
                      <td>
                        <form action={submitRemoveRule}>
                          <input type="hidden" name="legacyId" value={o.legacy!.id} />
                          <input type="hidden" name="ruleId" value={r.id} />
                          <button type="submit" className="link small" aria-label={`Remove rule for “${r.question}”`}>Remove</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {history.length > 0 && (
            <section className="card" aria-labelledby="hist-h">
              <h2 id="hist-h">Your recent practice questions</h2>
              <table>
                <thead><tr><th>When</th><th>Question</th><th>Result</th></tr></thead>
                <tbody>
                  {history.map((t) => (
                    <tr key={t.id}>
                      <td className="small">{formatDateTime(t.createdAt)}</td>
                      <td>{t.question ?? <span className="muted">(not stored)</span>}</td>
                      <td className="small">{KIND[t.kind]}{t.evidence ? ` · ${t.evidence}` : ""}{t.sources ? ` · ${t.sources} source${t.sources === 1 ? "" : "s"}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <form action={submitClearRehearsal}>
                <input type="hidden" name="legacyId" value={o.legacy.id} />
                <div className="actions"><button type="submit" className="secondary">Clear practice history</button></div>
              </form>
            </section>
          )}
        </>
      ) : (
        <p className="notice info">
          Practising answers needs the “AI processing” consent, because its text covers answering questions from your approved material.
          You can give it under <Link href="/legacy#consents">Your consents</Link>.
        </p>
      )}
    </>
  );
}
