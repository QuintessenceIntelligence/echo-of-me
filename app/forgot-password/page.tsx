import Link from "next/link";
import { redirect } from "next/navigation";
import { authMode } from "../../src/server/session";
import { requestPasswordReset } from "../auth-actions";
import { Notices } from "../components";

export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  if (authMode() !== "supabase") redirect("/sign-in");
  return (
    <>
      <h1>Forgot your password?</h1>
      <Notices searchParams={sp} />
      <form action={requestPasswordReset} className="card">
        <p>Enter the email address you signed up with. If it has an account, we will email you a link to choose a new password.</p>
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <div className="actions"><button type="submit">Email me a link</button></div>
      </form>
      <p className="small"><Link href="/sign-in">Back to sign in</Link></p>
    </>
  );
}
