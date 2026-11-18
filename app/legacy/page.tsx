import Link from "next/link";
import { redirect } from "next/navigation";
import { listCurrentDocuments, REQUIRED_AUTHOR_CONSENTS } from "../../src/domain/consent";
import { getOverview, RELATIONSHIPS } from "../../src/domain/onboarding";
import { listMemories } from "../../src/domain/vault";
import { listReports } from "../../src/domain/sharing";
import { getProgress } from "../../src/domain/progress";
import { submitStopSharingWith } from "../vault-actions";
import { requireSession } from "../../src/server/session";
import {
  giveOneConsent,
  submitAddRecipient,
  submitAddTrustedContact,
  submitFinishSetup,
  submitRemoveRecipient,
  submitRevokeInvitation,
  withdrawOneConsent,
} from "../actions";
import { CONSENT_LABELS, formatDateTime, Notices, RELATIONSHIP_LABELS } from "../components";
import { InviteButton } from "./InviteButton";

const STATUS_LABEL: Record<string, string> = {
  not_invited: "Not invited",
  invited: "Invitation sent",
  accepted: "Joined",
  revoked: "Invitation cancelled",
  left: "Left (you can invite them again)",
};

export default async function LegacyDashboard({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireSession("/legacy");
  const [o, docs] = await Promise.all([getOverview(ctx), listCurrentDocuments(ctx)]);
  if (!o.legacy) redirect("/home");
  const l = o.legacy;
  const docByPurpose = new Map(docs.map((d) => [d.purpose, d]));
  const shareConsent = o.consents.find((c) => c.purpose === "share_with_recipients")!;
  const items = await listMemories(ctx, l.id);
  const approvedCount = items.filter((i) => i.approval === "approved").length;
  const openReports = (await listReports(ctx, l.id)).filter((r) => !r.resolvedAt).length;
  const progress = await getProgress(ctx, l.id);
  const practiceTotal = progress.practiceAnswered + progress.practiceNotRecorded;

  return (
    <>
      <h1>{l.title}</h1>
      <p className="muted">
        Shown to your family as <strong>{l.authorDisplayName}</strong> ·{" "}
        <span className={`pill ${l.state === "active" ? "good" : "warn"}`}>{l.state === "active" ? "Active" : "Setting up"}</span>
      </p>
      <Notices searchParams={sp} />

      {l.state === "draft" && (
        <div className="card">
          <h2>Finish setting up</h2>
          <p className="muted">Add the people you are preserving this for, and a trusted contact if you wish. You can add more at any time.</p>
          <form action={submitFinishSetup}>
            <input type="hidden" name="legacyId" value={l.id} />
            <button type="submit">I have finished setting up</button>
          </form>
        </div>
      )}

      <section className="card" id="vault" aria-labelledby="vault-h">
        <h2 id="vault-h">Memories and values</h2>
        <p className="muted small">
          {items.length === 0
            ? "Nothing preserved yet. Start with one memory or one value you hold."
            : `${items.length} item${items.length === 1 ? "" : "s"}, ${approvedCount} approved. Drafts are never used in answers.`}
        </p>
        <div className="actions">
          <Link className="button" href="/legacy/memories">{items.length === 0 ? "Add your first memory" : "Open memories and values"}</Link>
          <Link className="button secondary" href="/legacy/prompts">Guided prompts</Link>
          {approvedCount > 0 && <Link className="button secondary" href="/legacy/rehearse">Practise questions</Link>}
        </div>
      </section>

      {openReports > 0 && (
        <p className="notice info">
          {openReports} answer{openReports === 1 ? " was" : "s were"} reported by your recipients. <Link href="/legacy/reports">Review reports</Link>
        </p>
      )}

      {items.length > 0 && (
        <section className="card" id="progress" aria-labelledby="progress-h">
          <h2 id="progress-h">Your progress</h2>
          <ul className="stats">
            <li><strong>{progress.approvedItems}</strong> approved{progress.draftItems ? `, ${progress.draftItems} draft${progress.draftItems === 1 ? "" : "s"}` : ""}</li>
            <li><strong>{progress.recordings}</strong> recording{progress.recordings === 1 ? "" : "s"} or photo{progress.recordings === 1 ? "" : "s"}</li>
            <li><strong>{progress.captureDays}</strong> day{progress.captureDays === 1 ? "" : "s"} spent preserving{progress.daysSinceLastCapture !== null && progress.daysSinceLastCapture > 13 ? ` · last time ${progress.daysSinceLastCapture} days ago` : ""}</li>
            {practiceTotal > 0 && <li><strong>{progress.practiceNotRecorded}</strong> of {practiceTotal} practice question{practiceTotal === 1 ? "" : "s"} found nothing recorded</li>}
            {progress.sharedItems > 0 && <li><strong>{progress.sharedItems}</strong> item{progress.sharedItems === 1 ? "" : "s"} shared</li>}
          </ul>
          <p className="muted small">Only you can see this. It is worked out from your own records; nothing extra is collected.</p>
        </section>
      )}

      <section className="card" id="recipients" aria-labelledby="recipients-h">
        <h2 id="recipients-h">Recipients</h2>
        <p className="muted small">
          Adding someone shares nothing with them. Each person will see only what you later choose to share with them.
          Children are kept as records and cannot sign in.
        </p>
        {l.recipients.length > 0 && (
          <table>
            <thead>
              <tr><th>Name</th><th>Relationship</th><th>Status</th><th>Shared with them</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {l.recipients.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.displayName}
                    {r.email && <div className="muted small">{r.email}</div>}
                  </td>
                  <td>{RELATIONSHIP_LABELS[r.relationship]}{r.isMinor && <div><span className="pill">Child · record only</span></div>}</td>
                  <td>{r.isMinor ? "—" : STATUS_LABEL[r.invitationStatus]}</td>
                  <td>{r.sharedItemCount === 0 ? "Nothing yet" : `${r.sharedItemCount} item${r.sharedItemCount === 1 ? "" : "s"}`}</td>
                  <td>
                    {!r.isMinor && r.email && r.invitationStatus !== "accepted" && (
                      <InviteButton legacyId={l.id} recipientId={r.id} label={r.invitationStatus === "invited" ? "New link" : "Invite"} />
                    )}
                    {r.invitationStatus === "invited" && (
                      <form action={submitRevokeInvitation}>
                        <input type="hidden" name="legacyId" value={l.id} />
                        <input type="hidden" name="recipientId" value={r.id} />
                        <button className="link small" type="submit">Cancel invitation</button>
                      </form>
                    )}
                    {r.sharedItemCount > 0 && (
                      <form action={submitStopSharingWith}>
                        <input type="hidden" name="legacyId" value={l.id} />
                        <input type="hidden" name="recipientId" value={r.id} />
                        <button className="link small" type="submit" aria-label={`Stop sharing everything with ${r.displayName}`}>Stop sharing everything</button>
                      </form>
                    )}
                    <form action={submitRemoveRecipient}>
                      <input type="hidden" name="legacyId" value={l.id} />
                      <input type="hidden" name="recipientId" value={r.id} />
                      <button className="link small" type="submit">Remove</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {shareConsent.state !== "granted" && (
          <p className="notice info small">To invite adults to join, first agree to “Inviting and sharing with recipients” under Your consents below.</p>
        )}
        <details open={l.recipients.length === 0}>
          <summary>Add a recipient</summary>
          <form action={submitAddRecipient}>
            <input type="hidden" name="legacyId" value={l.id} />
            <div className="row">
              <div>
                <label htmlFor="r-name">Name</label>
                <input id="r-name" name="displayName" type="text" required maxLength={120} />
              </div>
              <div>
                <label htmlFor="r-rel">Relationship to you</label>
                <select id="r-rel" name="relationship" required defaultValue="child">
                  {RELATIONSHIPS.map((k) => <option key={k} value={k}>{RELATIONSHIP_LABELS[k]}</option>)}
                </select>
              </div>
            </div>
            <fieldset className="plain">
              <legend>Age</legend>
              <label className="check"><input type="radio" name="ageGroup" value="adult" defaultChecked /> Adult (18 or older)</label>
              <label className="check"><input type="radio" name="ageGroup" value="minor" /> Under 18 (kept as a record only, no email)</label>
            </fieldset>
            <label htmlFor="r-email">Email (adults only, needed to invite them)</label>
            <input id="r-email" name="email" type="email" maxLength={254} />
            <div className="actions"><button type="submit">Add recipient</button></div>
          </form>
        </details>
      </section>

      <section className="card" id="trusted" aria-labelledby="trusted-h">
        <h2 id="trusted-h">Trusted contact</h2>
        <p className="muted small">Someone you trust to help in future. In this version this is a record only: they cannot sign in and have no powers.</p>
        {l.trustedContacts.length > 0 && (
          <ul>{l.trustedContacts.map((t) => <li key={t.id}>{t.displayName}{t.relationship ? ` (${t.relationship})` : ""}</li>)}</ul>
        )}
        <details open={l.trustedContacts.length === 0}>
          <summary>Add a trusted contact</summary>
          <form action={submitAddTrustedContact}>
            <input type="hidden" name="legacyId" value={l.id} />
            <div className="row">
              <div><label htmlFor="t-name">Name</label><input id="t-name" name="displayName" type="text" required maxLength={120} /></div>
              <div><label htmlFor="t-rel">Relationship (optional)</label><input id="t-rel" name="relationship" type="text" maxLength={80} /></div>
            </div>
            <label htmlFor="t-email">Email (optional)</label>
            <input id="t-email" name="email" type="email" maxLength={254} />
            <div className="actions"><button type="submit">Save trusted contact</button></div>
          </form>
        </details>
      </section>

      <section className="card" id="consents" aria-labelledby="consents-h">
        <h2 id="consents-h">Your consents</h2>
        <p className="muted small">Each record shows the exact version you agreed to and when. You can withdraw any optional consent at any time.</p>
        <table>
          <thead><tr><th>Consent</th><th>Status</th><th>Agreed version and time</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {o.consents.filter((c) => c.purpose !== "recipient_terms").map((c) => {
              const required = REQUIRED_AUTHOR_CONSENTS.includes(c.purpose);
              const doc = docByPurpose.get(c.purpose)!;
              return (
                <tr key={c.purpose}>
                  <td>{CONSENT_LABELS[c.purpose]}{required && <div className="muted small">Required</div>}</td>
                  <td>
                    <span className={`pill ${c.state === "granted" ? "good" : c.state === "needs_reconsent" ? "warn" : ""}`}>
                      {{ granted: "Agreed", withdrawn: "Withdrawn", never_given: "Not given", needs_reconsent: "Text updated, please review" }[c.state]}
                    </span>
                  </td>
                  <td className="small">
                    {c.agreedVersion ? <>v{c.agreedVersion} · {formatDateTime(c.recordedAt!)}<div className="mono">sha256 {c.agreedSha256!.slice(0, 16)}…</div></> : c.recordedAt ? `Withdrawn ${formatDateTime(c.recordedAt)}` : "—"}
                  </td>
                  <td>
                    {c.state === "granted" && !required && (
                      <form action={withdrawOneConsent}>
                        <input type="hidden" name="purpose" value={c.purpose} />
                        <button className="danger small" type="submit">Withdraw</button>
                      </form>
                    )}
                    {c.state !== "granted" && (
                      <details>
                        <summary className="small">Read and agree</summary>
                        <div className="consent-text">{doc.body}</div>
                        <form action={giveOneConsent}>
                          <input type="hidden" name="purpose" value={c.purpose} />
                          <input type="hidden" name="documentId" value={doc.id} />
                          <button className="small" type="submit">I agree to version {doc.version}</button>
                        </form>
                      </details>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted small">Required consents cannot be withdrawn here; deleting your legacy will be available in a later version.</p>
      </section>

      <div className="actions">
        <Link className="button secondary" href="/legacy/activity">Activity log</Link>
        <Link className="button secondary" href="/legacy/export">Export everything</Link>
        <Link className="button secondary" href="/legacy/delete">Delete this legacy</Link>
        {ctx.aal !== "aal2" && <Link className="button secondary" href="/mfa?next=/legacy">Confirm second factor</Link>}
      </div>
    </>
  );
}
