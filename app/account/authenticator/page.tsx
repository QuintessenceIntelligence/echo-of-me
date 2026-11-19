import Link from "next/link";
import { redirect } from "next/navigation";
import { authMode, requireSession } from "../../../src/server/session";
import { Notices } from "../../components";
import { EnrollTotp } from "../../mfa/EnrollTotp";

/** New phone: set up a new authenticator app; the old one stops working once the new one is confirmed (ADR-015). */
export default async function ReplaceAuthenticator({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  if (authMode() !== "supabase") redirect("/account");
  const s = await requireSession("/account/authenticator");
  if (s.aal !== "aal2") redirect(`/mfa?next=${encodeURIComponent("/account/authenticator")}`);
  return (
    <>
      <p className="small"><Link href="/account">← Your account</Link></p>
      <h1>Replace your authenticator app</h1>
      <Notices searchParams={sp} />
      <div className="card">
        <p>Use this when you move to a new phone. Your current app keeps working until the new one is confirmed.</p>
        <p className="muted small">Lost your phone and cannot get a code? This test version cannot recover that yet; the project team has to reset it.</p>
        <EnrollTotp next={`/account?ok=${encodeURIComponent("Your new authenticator app is set up. The old one no longer works.")}`} replace />
      </div>
    </>
  );
}
