import Link from "next/link";
import { redirect } from "next/navigation";
import { getOverview } from "../../src/domain/onboarding";
import { requireSession } from "../../src/server/session";
import { formatDateTime, Notices } from "../components";

/** Routes a signed-in person to the right next step, and shows legacies they joined as a recipient. */
export default async function Home({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireSession("/home");
  const o = await getOverview(ctx);
  const has = (p: string) => o.consents.find((c) => c.purpose === p)?.state === "granted";

  if (o.memberships.length === 0) {
    if (!has("terms_of_service") || !has("privacy_notice")) redirect("/onboarding/consents");
    if (!o.legacy) redirect("/onboarding/legacy");
    redirect("/legacy");
  }

  return (
    <>
      <h1>Welcome, {o.account.displayName}</h1>
      <Notices searchParams={sp} />
      {o.memberships.map((m) => (
        <div className="card" key={m.legacyId}>
          <h2>{m.legacyTitle}</h2>
          <p className="muted small">From {m.authorDisplayName} · joined {formatDateTime(m.acceptedAt)}</p>
          {m.sharedCount === 0 ? (
            <p>Nothing has been shared with you yet. You will see items here only when {m.authorDisplayName} chooses to share them with you.</p>
          ) : (
            <>
              <p>{m.authorDisplayName} has shared {m.sharedCount} item{m.sharedCount === 1 ? "" : "s"} with you.</p>
              <div className="actions"><Link className="button" href={`/shared/${m.legacyId}`}>Open what was shared</Link></div>
            </>
          )}
        </div>
      ))}
      <div className="card">
        <h2>Your own legacy</h2>
        {o.legacy ? (
          <Link className="button secondary" href="/legacy">Open your legacy</Link>
        ) : (
          <>
            <p className="muted">You can also start preserving your own memories and values.</p>
            <Link className="button secondary" href="/onboarding/consents">Start your legacy</Link>
          </>
        )}
      </div>
    </>
  );
}
