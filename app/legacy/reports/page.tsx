import Link from "next/link";
import { redirect } from "next/navigation";
import { getOverview } from "../../../src/domain/onboarding";
import { listReports } from "../../../src/domain/sharing";
import { requireSession } from "../../../src/server/session";
import { formatDateTime, Notices } from "../../components";
import { submitResolveReport } from "../../vault-actions";

const REASON: Record<string, string> = {
  not_what_they_meant: "Not what you meant",
  wrong_or_outdated: "Wrong or out of date",
  upsetting: "Upsetting",
  other: "Something else",
};

/** Answers your recipients reported, so you can fix them (pin, hide or answer yourself on the practice page). */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireSession("/legacy/reports");
  const o = await getOverview(ctx);
  if (!o.legacy) redirect("/home");
  const reports = await listReports(ctx, o.legacy.id);
  return (
    <>
      <p className="small"><Link href="/legacy">← {o.legacy.title}</Link></p>
      <h1>Reported answers</h1>
      <p className="muted">When someone you shared with tells you an answer was wrong or upsetting, it appears here. Their question is shown only if they chose to include it.
        To fix an answer, ask the same question on the <Link href="/legacy/rehearse">practice page</Link> and pin, hide or answer it yourself.</p>
      <Notices searchParams={sp} />
      {reports.length === 0 ? (
        <div className="card"><p className="muted">No reports.</p></div>
      ) : (
        reports.map((r) => (
          <div className="card" key={r.id}>
            <p>
              <span className={r.resolvedAt ? "pill" : "pill warn"}>{r.resolvedAt ? "Dealt with" : "Open"}</span>{" "}
              <strong>{REASON[r.reason]}</strong> · {r.reporter ?? "A recipient"} · {formatDateTime(r.createdAt)}
            </p>
            {r.question ? <p>Their question: “{r.question}”</p> : <p className="muted small">They did not include their question.</p>}
            {r.note && <p>Their note: “{r.note}”</p>}
            <p className="small">
              Answer type: {r.evidence ?? "–"} · Based on: {r.sources.length ? r.sources.map((s, i) => (
                <span key={s.memoryId}>{i ? ", " : ""}<Link href={`/legacy/memories/${s.memoryId}`}>{s.title}</Link></span>
              )) : "nothing (not recorded)"}
            </p>
            {!r.resolvedAt && (
              <form action={submitResolveReport}>
                <input type="hidden" name="legacyId" value={o.legacy!.id} />
                <input type="hidden" name="reportId" value={r.id} />
                <button type="submit" className="secondary">Mark as dealt with</button>
              </form>
            )}
          </div>
        ))
      )}
    </>
  );
}
