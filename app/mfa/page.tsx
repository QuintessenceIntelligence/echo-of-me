import { authMode, readProviderSession, requireSession } from "../../src/server/session";
import { goTrue } from "../../src/server/supabase-auth";
import { devConfirmSecondFactor } from "../actions";
import { verifyTotpCode } from "../auth-actions";
import { Notices } from "../components";
import { EnrollTotp } from "./EnrollTotp";

export default async function Mfa({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession("/mfa");
  const next = sp.next ?? "/legacy";
  const intro = <p>Inviting people and other sensitive actions need a second sign-in step, from an authenticator app.</p>;

  if (authMode() === "supabase") {
    let hasFactor = false;
    let unavailable = false;
    if (s.aal !== "aal2") {
      const tokens = await readProviderSession();
      try {
        hasFactor = Boolean(tokens && (await goTrue().getUser(tokens.accessToken)).verifiedTotpFactorId);
      } catch {
        unavailable = true;
      }
    }
    return (
      <>
        <h1>Confirm it is you</h1>
        <Notices searchParams={sp} />
        <div className="card">
          {intro}
          {s.aal === "aal2" ? (
            <p className="pill good">Second step confirmed for this session</p>
          ) : unavailable ? (
            <p className="notice error small" role="alert">Sign-in is temporarily unavailable. Please try again shortly.</p>
          ) : hasFactor ? (
            <form action={verifyTotpCode}>
              <input type="hidden" name="next" value={next} />
              <label htmlFor="code">Enter the 6-digit code from your authenticator app</label>
              <input id="code" name="code" type="text" inputMode="numeric" pattern="[0-9 ]{6,7}" autoComplete="one-time-code" required />
              <div className="actions"><button type="submit">Confirm</button></div>
            </form>
          ) : (
            <EnrollTotp next={next} />
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Confirm it is you</h1>
      <div className="card">
        {intro}
        <div className="notice info small">
          <strong>Simulated in this build.</strong> The real check will come from the identity provider. Pressing the button
          below marks this session as verified without any real second factor.
        </div>
        {s.aal === "aal2" ? (
          <p className="pill good">Second factor confirmed for this session</p>
        ) : (
          <form action={devConfirmSecondFactor}>
            <input type="hidden" name="next" value={next} />
            <button type="submit">Simulate second-factor confirmation</button>
          </form>
        )}
      </div>
    </>
  );
}
