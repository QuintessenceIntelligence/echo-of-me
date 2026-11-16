import { authMode } from "../../src/server/session";
import { devSignIn } from "../actions";
import { Notices } from "../components";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  if (authMode() !== "dev") {
    return (
      <div className="card">
        <h1>Sign in</h1>
        <p>Sign-in is not available yet. The identity provider (with two-factor authentication) has not been connected.</p>
      </div>
    );
  }
  return (
    <>
      <h1>Sign in</h1>
      <Notices searchParams={sp} />
      <div className="notice info small">
        <strong>Development sign-in.</strong> No password and no real verification. In the real product, sign-in and
        two-factor authentication will come from an identity provider (ADR-004).
      </div>
      <form action={devSignIn} className="card">
        <input type="hidden" name="next" value={sp.next ?? "/home"} />
        <label htmlFor="email">Email address</label>
        <input id="email" name="email" type="email" required autoComplete="email" />
        <label htmlFor="displayName">Your name</label>
        <input id="displayName" name="displayName" type="text" autoComplete="name" />
        <div className="actions">
          <button type="submit">Continue</button>
        </div>
      </form>
    </>
  );
}
