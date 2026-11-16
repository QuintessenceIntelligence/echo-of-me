import Link from "next/link";
import { redirect } from "next/navigation";
import { getOverview } from "../../../src/domain/onboarding";
import { requireSession } from "../../../src/server/session";
import { Notices } from "../../components";

export default async function ExportPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireSession("/legacy/export");
  const o = await getOverview(ctx);
  if (!o.legacy) redirect("/home");
  return (
    <>
      <p className="small"><Link href="/legacy">← {o.legacy.title}</Link></p>
      <h1>Export everything</h1>
      <Notices searchParams={sp} />
      <div className="card">
        <p>Download one ZIP file with everything you have preserved, in open formats you can keep without Echo of Me:</p>
        <ul>
          <li><strong>legacy.json</strong>: every memory and value, every earlier version, approvals, tags, who each item is for, your consents and the activity log.</li>
          <li><strong>originals/</strong>: your recordings and photos exactly as you made them.</li>
          <li><strong>SHA256SUMS</strong>: a fingerprint for each original, so anyone can check nothing was changed.</li>
        </ul>
        <p className="muted small">The file contains personal information. Keep it somewhere safe. Exporting needs your second sign-in factor{ctx.aal === "aal2" ? " (confirmed for this session)" : ""}.</p>
        <form method="post" action="/legacy/export/download">
          <button type="submit">Download export</button>
        </form>
      </div>
    </>
  );
}
