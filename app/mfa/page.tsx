import { requireSession } from "../../src/server/session";
import { devConfirmSecondFactor } from "../actions";

export default async function Mfa({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const s = await requireSession("/mfa");
  return (
    <>
      <h1>Confirm it is you</h1>
      <div className="card">
        <p>Inviting people and other sensitive actions need a second sign-in factor, such as an authenticator app.</p>
        <div className="notice info small">
          <strong>Simulated in this build.</strong> The real check will come from the identity provider. Pressing the button
          below marks this session as verified without any real second factor.
        </div>
        {s.aal === "aal2" ? (
          <p className="pill good">Second factor confirmed for this session</p>
        ) : (
          <form action={devConfirmSecondFactor}>
            <input type="hidden" name="next" value={sp.next ?? "/legacy"} />
            <button type="submit">Simulate second-factor confirmation</button>
          </form>
        )}
      </div>
    </>
  );
}
