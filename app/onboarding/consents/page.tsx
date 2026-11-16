import { listCurrentDocuments, OPTIONAL_AUTHOR_CONSENTS, REQUIRED_AUTHOR_CONSENTS } from "../../../src/domain/consent";
import { getOverview } from "../../../src/domain/onboarding";
import { requireSession } from "../../../src/server/session";
import { submitOnboardingConsents } from "../../actions";
import { Notices } from "../../components";

export default async function ConsentStep({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireSession("/onboarding/consents");
  const [docs, overview] = await Promise.all([listCurrentDocuments(ctx), getOverview(ctx)]);
  const state = (p: string) => overview.consents.find((c) => c.purpose === p)?.state;
  const byPurpose = new Map(docs.map((d) => [d.purpose, d]));

  const block = (purpose: string, required: boolean) => {
    const d = byPurpose.get(purpose as never)!;
    const already = state(purpose) === "granted";
    return (
      <div className="card" key={purpose}>
        <h3>
          {d.title} <span className="pill">version {d.version}</span>{" "}
          {d.legalReviewStatus !== "reviewed" && <span className="pill warn">draft, not legally reviewed</span>}
        </h3>
        <div className="consent-text" id={`text-${purpose}`}>{d.body}</div>
        <input type="hidden" name={`doc:${purpose}`} value={d.id} />
        {already ? (
          <p className="pill good">Already agreed</p>
        ) : (
          <label className="check">
            <input type="checkbox" name={`consent:${purpose}`} required={required} aria-describedby={`text-${purpose}`} />
            {required ? "I agree (required)" : "I agree (optional, you can change this later)"}
          </label>
        )}
      </div>
    );
  };

  return (
    <>
      <h1>Before we begin</h1>
      <p className="muted">Step 1 of 2. Please read each item. The first two are needed to create a legacy; the others are your choice and can be changed at any time.</p>
      <Notices searchParams={sp} />
      <form action={submitOnboardingConsents}>
        {REQUIRED_AUTHOR_CONSENTS.map((p) => block(p, true))}
        <h2>Optional</h2>
        {OPTIONAL_AUTHOR_CONSENTS.map((p) => block(p, false))}
        <div className="actions">
          <button type="submit">Save and continue</button>
        </div>
      </form>
    </>
  );
}
