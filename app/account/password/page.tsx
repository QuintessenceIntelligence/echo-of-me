import Link from "next/link";
import { redirect } from "next/navigation";
import { authMode, readProviderSession, requireSession } from "../../../src/server/session";
import { goTrue, MIN_PASSWORD } from "../../../src/server/supabase-auth";
import { changePassword } from "../../auth-actions";
import { Notices } from "../../components";

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ reset?: string; error?: string }> }) {
  const sp = await searchParams;
  if (authMode() !== "supabase") redirect("/account");
  const s = await requireSession("/account/password");
  let needsCode = false;
  if (s.aal !== "aal2") {
    const tokens = await readProviderSession();
    needsCode = Boolean(tokens && (await goTrue().getUser(tokens.accessToken).catch(() => null))?.verifiedTotpFactorId);
  }
  return (
    <>
      <p className="small"><Link href="/account">← Your account</Link></p>
      <h1>{sp.reset ? "Choose a new password" : "Change your password"}</h1>
      <Notices searchParams={sp} />
      <form action={changePassword} className="card">
        <label htmlFor="password">New password (at least {MIN_PASSWORD} characters)</label>
        <input id="password" name="password" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" />
        <label htmlFor="password2">Type it again</label>
        <input id="password2" name="password2" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" />
        {needsCode && (
          <>
            <label htmlFor="code">Code from your authenticator app</label>
            <input id="code" name="code" type="text" inputMode="numeric" pattern="[0-9 ]{6,7}" autoComplete="one-time-code" required />
          </>
        )}
        <p className="muted small">Other devices signed in to your account will be signed out.</p>
        <div className="actions"><button type="submit">Save new password</button></div>
      </form>
    </>
  );
}
