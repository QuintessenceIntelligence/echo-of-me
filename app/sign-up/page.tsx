import Link from "next/link";
import { redirect } from "next/navigation";
import { authMode } from "../../src/server/session";
import { MIN_PASSWORD } from "../../src/server/supabase-auth";
import { supabaseSignUp } from "../auth-actions";
import { Notices } from "../components";

/** Account creation with Supabase Auth (ADR-015). In development mode, sign-in creates accounts directly. */
export default async function SignUp({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  if (authMode() !== "supabase") redirect("/sign-in");
  const next = sp.next ?? "/home";
  return (
    <>
      <h1>Create an account</h1>
      <Notices searchParams={sp} />
      <form action={supabaseSignUp} className="card">
        <input type="hidden" name="next" value={next} />
        <label htmlFor="displayName">Your name</label>
        <input id="displayName" name="displayName" type="text" required maxLength={120} autoComplete="name" />
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="password">Password (at least {MIN_PASSWORD} characters)</label>
        <input id="password" name="password" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" />
        <label htmlFor="password2">Type the password again</label>
        <input id="password2" name="password2" type="password" required minLength={MIN_PASSWORD} autoComplete="new-password" />
        <p className="muted small">
          You will also set up an authenticator app (a second sign-in step) before inviting anyone or doing anything that
          shares or deletes what you have recorded.
        </p>
        <div className="actions">
          <button type="submit">Create account</button>
        </div>
      </form>
      <p className="small">Already have an account? <Link href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in</Link></p>
    </>
  );
}
