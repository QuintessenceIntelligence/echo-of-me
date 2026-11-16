import Link from "next/link";
import { listCurrentDocuments } from "../../../src/domain/consent";
import { getOverview } from "../../../src/domain/onboarding";
import { readSession } from "../../../src/server/session";
import { submitAcceptInvitation } from "../../actions";
import { Notices } from "../../components";

/** Recipient landing page. Reveals nothing about the legacy until the right person accepts. */
export default async function Invite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const ctx = await readSession();
  if (!ctx) {
    return (
      <div className="card">
        <h1>You have been invited</h1>
        <p>Someone has chosen to preserve memories and guidance for you in Echo of Me.</p>
        <p className="muted">Please sign in with the email address this invitation was sent to.</p>
        <Link className="button" href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`}>Sign in to continue</Link>
      </div>
    );
  }
  const [docs, o] = await Promise.all([listCurrentDocuments(ctx), getOverview(ctx)]);
  const terms = docs.find((d) => d.purpose === "recipient_terms")!;
  return (
    <>
      <h1>You have been invited</h1>
      <Notices searchParams={sp} />
      <p className="muted">Signed in as {o.account.email}.</p>
      <form action={submitAcceptInvitation} className="card">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="termsDocumentId" value={terms.id} />
        <h3>
          {terms.title} <span className="pill">version {terms.version}</span>{" "}
          {terms.legalReviewStatus !== "reviewed" && <span className="pill warn">draft, not legally reviewed</span>}
        </h3>
        <div className="consent-text">{terms.body}</div>
        <label className="check">
          <input type="checkbox" name="agree" required /> I agree and want to join
        </label>
        <div className="actions"><button type="submit">Accept invitation</button></div>
      </form>
    </>
  );
}
