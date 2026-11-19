import Link from "next/link";
import { getAccount } from "../../src/domain/account";
import { authMode, requireSession } from "../../src/server/session";
import { submitCloseAccount, submitLeaveLegacy } from "../account-actions";
import { formatDateTime, Notices } from "../components";

/** Your account and your personal-data rights (ADR-013). */
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireSession("/account");
  const a = await getAccount(ctx);
  const mfaNote = `Needs your second sign-in step${ctx.aal === "aal2" ? " (confirmed for this session)" : ""}.`;
  return (
    <>
      <p className="small"><Link href="/home">← Home</Link></p>
      <h1>Your account</h1>
      <Notices searchParams={sp} />

      <div className="card">
        <dl className="facts">
          <dt>Name</dt><dd>{a.displayName}</dd>
          <dt>Email</dt><dd>{a.email}</dd>
          <dt>Created</dt><dd>{formatDateTime(a.createdAt)}</dd>
        </dl>
        {authMode() === "supabase" && (
          <p className="small">
            <Link href="/account/password">Change your password</Link> · <Link href="/account/authenticator">Replace your authenticator app</Link>
          </p>
        )}
      </div>

      <section className="card" id="data" aria-labelledby="data-h">
        <h2 id="data-h">Download your data</h2>
        <p>
          A file with everything held about your account itself: your details, your consent history, the legacies you joined,
          the questions you asked, reports you made and your own activity.
        </p>
        <p className="muted small">
          The memories and values in a legacy belong to its author and are not included.
          {a.ownedLegacy && <> To copy your own legacy, use <Link href="/legacy/export">Export everything</Link>.</>}
        </p>
        <form method="post" action="/account/data/download">
          <p className="muted small">{mfaNote}</p>
          <div className="actions"><button type="submit" className="secondary">Download my data</button></div>
        </form>
      </section>

      <section className="card" id="memberships" aria-labelledby="memberships-h">
        <h2 id="memberships-h">Legacies you joined</h2>
        {a.memberships.length === 0 ? (
          <p className="muted">You have not joined anyone's legacy.</p>
        ) : (
          a.memberships.map((m) => (
            <form action={submitLeaveLegacy} className="subcard" key={m.legacyId}>
              <input type="hidden" name="legacyId" value={m.legacyId} />
              <p><strong>{m.legacyTitle}</strong> <span className="muted small">from {m.authorDisplayName} · joined {formatDateTime(m.acceptedAt)}</span></p>
              <p className="muted small">
                Leaving ends your access at once and deletes the questions you asked there. {m.authorDisplayName} will see that you left
                and could invite you again.
              </p>
              <label className="check"><input type="checkbox" name="understand" required /> I want to leave {m.legacyTitle}</label>
              <div className="actions"><button type="submit" className="secondary">Leave this legacy</button></div>
            </form>
          ))
        )}
      </section>

      <section className="card" id="close" aria-labelledby="close-h">
        <h2 id="close-h">Close your account</h2>
        {a.ownedLegacy ? (
          <p>
            You author <strong>{a.ownedLegacy.title}</strong>. Closing your account never deletes a legacy by accident, so
            first <Link href="/legacy/export">export it</Link> if you want a copy, then <Link href="/legacy/delete">delete it</Link>.
            You can close your account after that.
          </p>
        ) : (
          <form action={submitCloseAccount}>
            <p>
              Closing your account signs you out, ends your access to every legacy you joined, deletes the questions you asked
              and removes your name and email address. It cannot be undone.
            </p>
            <p className="muted small">
              Kept without your name or email: your consent history and the activity log, which record what was agreed and done.
              You can sign up again later with the same email address as a new person.
            </p>
            <label htmlFor="confirm-email">Type your email address to confirm: <strong>{a.email}</strong></label>
            <input id="confirm-email" name="confirmEmail" type="email" required autoComplete="off" />
            <label className="check"><input type="checkbox" name="understand" required /> I understand that closing my account cannot be undone</label>
            <p className="muted small">{mfaNote}</p>
            <div className="actions"><button type="submit" className="danger">Close my account</button></div>
          </form>
        )}
      </section>
    </>
  );
}
