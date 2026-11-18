import Link from "next/link";
import { redirect } from "next/navigation";
import { getOverview } from "../../../src/domain/onboarding";
import { gapQuestions, listPrompts, THEME_LABEL, THEMES } from "../../../src/domain/prompts";
import { requireSession } from "../../../src/server/session";
import { formatDateTime, Notices } from "../../components";
import { submitPromptDismissal } from "../../vault-actions";

/** Module 05: questions to help you remember what you might otherwise leave out. */
export default async function PromptsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireSession("/legacy/prompts");
  const o = await getOverview(ctx);
  if (!o.legacy) redirect("/home");
  const legacyId = o.legacy.id;
  const prompts = await listPrompts(ctx, legacyId);
  const practiceOn = o.consents.find((c) => c.purpose === "ai_processing")?.state === "granted";
  const gaps = practiceOn ? await gapQuestions(ctx, legacyId) : [];
  const answered = prompts.filter((p) => p.answeredBy.length > 0).length;
  const hidden = prompts.filter((p) => p.dismissed);

  const dismissForm = (id: string, theme: string, dismiss: boolean, label: string) => (
    <form action={submitPromptDismissal} className="inline">
      <input type="hidden" name="legacyId" value={legacyId} />
      <input type="hidden" name="promptId" value={id} />
      <input type="hidden" name="theme" value={theme} />
      <input type="hidden" name="dismiss" value={dismiss ? "yes" : "no"} />
      <button type="submit" className="link small">{label}</button>
    </form>
  );

  return (
    <>
      <p className="small"><Link href="/legacy">← {o.legacy.title}</Link></p>
      <h1>Guided prompts</h1>
      <p className="muted">
        Questions to help you remember the stories and lessons you might otherwise leave out. Answer any of them, in any order, in your own words or
        with a recording. You have answered {answered} of {prompts.length}.
      </p>
      <p className="muted small">These questions were written by the Echo of Me team (draft set v0.1). Nothing is learned from other families.</p>
      <Notices searchParams={sp} />

      {gaps.length > 0 && (
        <section className="card" id="gaps" aria-labelledby="gaps-h">
          <h2 id="gaps-h">Questions you could not answer yet</h2>
          <p className="muted small">From your practice: these got “not recorded”. Answering them fills the gap for the people you share with.</p>
          <ul className="prompt-list">
            {gaps.map((g) => (
              <li key={g.question}>
                <span>{g.question}</span>{" "}
                <span className="muted small">asked {g.times > 1 ? `${g.times} times, last ` : ""}{formatDateTime(g.askedAt)}</span>{" "}
                <Link className="small" href={`/legacy/memories?title=${encodeURIComponent(g.question.slice(0, 160))}#add`}>Answer it</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Themes" className="small theme-nav">
        {THEMES.map((t) => <a key={t} href={`#${t}`}>{THEME_LABEL[t]}</a>)}
      </nav>

      {THEMES.map((t) => {
        const list = prompts.filter((p) => p.theme === t && !p.dismissed);
        return (
          <section className="card" id={t} key={t} aria-labelledby={`h-${t}`}>
            <h2 id={`h-${t}`}>{THEME_LABEL[t]} <span className="muted small">({prompts.filter((p) => p.theme === t && p.answeredBy.length).length} of {prompts.filter((p) => p.theme === t).length} answered)</span></h2>
            <ul className="prompt-list">
              {list.map((p) => (
                <li key={p.id}>
                  <div>{p.text}</div>
                  {p.gentle && <div className="muted small">This one can be hard to think about. Skip it whenever you like.</div>}
                  <div className="small actions-inline">
                    {p.answeredBy.length > 0 ? (
                      <>
                        <span className="pill good">Answered</span>
                        {p.answeredBy.map((m) => <Link key={m.memoryId} href={`/legacy/memories/${m.memoryId}`}>{m.title}</Link>)}
                        <Link href={`/legacy/memories?prompt=${p.id}#add`}>Add another answer</Link>
                      </>
                    ) : (
                      <Link href={`/legacy/memories?prompt=${p.id}#add`} aria-label={`Answer: ${p.text}`}>Answer this</Link>
                    )}
                    {dismissForm(p.id, t, true, "Hide")}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {hidden.length > 0 && (
        <section className="card" aria-labelledby="hidden-h">
          <h2 id="hidden-h">Hidden prompts</h2>
          <ul className="prompt-list">
            {hidden.map((p) => <li key={p.id}><span className="muted">{p.text}</span> {dismissForm(p.id, p.theme, false, "Show again")}</li>)}
          </ul>
        </section>
      )}
    </>
  );
}
