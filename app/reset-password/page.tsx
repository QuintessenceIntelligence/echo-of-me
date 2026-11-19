import { redirect } from "next/navigation";
import { authMode } from "../../src/server/session";
import { completePasswordReset } from "../auth-actions";

/** Landing page for the reset link. Nothing happens until the person presses the button (see the action). */
export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token_hash?: string }> }) {
  const sp = await searchParams;
  if (authMode() !== "supabase") redirect("/sign-in");
  if (!sp.token_hash) redirect("/forgot-password");
  return (
    <>
      <h1>Choose a new password</h1>
      <form action={completePasswordReset} className="card">
        <input type="hidden" name="token_hash" value={sp.token_hash} />
        <p>Press continue to use your reset link. You will then choose your new password.</p>
        <div className="actions"><button type="submit">Continue</button></div>
      </form>
    </>
  );
}
