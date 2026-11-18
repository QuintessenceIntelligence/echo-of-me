import { redirect } from "next/navigation";
import { getOverview } from "../../../src/domain/onboarding";
import { requireSession } from "../../../src/server/session";
import { submitCreateLegacy } from "../../actions";
import { Notices } from "../../components";

export default async function LegacyStep({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireSession("/onboarding/legacy");
  const o = await getOverview(ctx);
  if (o.legacy) redirect("/legacy");
  return (
    <>
      <h1>Create your legacy</h1>
      <p className="muted">Step 2 of 2. You can change all of this later.</p>
      <Notices searchParams={sp} />
      <form action={submitCreateLegacy} className="card">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" type="text" required maxLength={160} placeholder="For example: Letters for my children" />
        <label htmlFor="authorDisplayName">How should your family see your name?</label>
        <input id="authorDisplayName" name="authorDisplayName" type="text" required maxLength={120} defaultValue={o.account.displayName} placeholder="For example: Dad, Mum, Nani" />
        <label htmlFor="about">A few words about why you are doing this (optional)</label>
        <textarea id="about" name="about" maxLength={2000} />
        <div className="actions">
          <button type="submit">Create legacy</button>
        </div>
      </form>
    </>
  );
}
