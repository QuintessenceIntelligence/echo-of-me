import { redirect } from "next/navigation";
import { getAuditLog, getOverview } from "../../../src/domain/onboarding";
import { requireSession } from "../../../src/server/session";
import { CONSENT_LABELS, formatDateTime } from "../../components";

const ACTION_LABEL: Record<string, string> = {
  "account.provision": "Account created",
  "consent.grant": "Consent given",
  "consent.withdraw": "Consent withdrawn",
  "legacy.create": "Legacy created",
  "legacy.activate": "Setup completed",
  "recipient.add": "Recipient added",
  "recipient.remove": "Recipient removed",
  "trusted_contact.add": "Trusted contact added",
  "invitation.create": "Invitation created",
  "invitation.revoke": "Invitation cancelled",
  "invitation.accept": "Invitation accepted",
  "memory.create": "Memory or value added",
  "memory.edit": "New version saved",
  "memory.approve": "Approved",
  "memory.unapprove": "Returned to draft",
  "memory.sensitivity": "Sensitivity changed",
  "memory.audience": "Intended recipients changed",
  "memory.delete": "Item deleted",
  "media.add": "Recording or photo added",
  "media.delete": "Recording or photo deleted",
  "media.integrity_failure": "Recording failed its integrity check",
  "transcript.save": "Transcript saved",
  "transcript.approve": "Transcript approved",
  "transcript.unapprove": "Transcript approval withdrawn",
  "transcript.machine": "Machine transcript",
  "tag.add": "Tag added",
  "tag.remove": "Tag removed",
  "tag.suggest": "Themes suggested automatically",
  "tag.approve": "Suggestion accepted",
  "tag.reject": "Suggestion rejected",
  "tag.withdraw_suggestions": "Pending suggestions removed",
  "legacy.export": "Export downloaded",
  "answer.rehearse": "Practice question answered",
  "rehearsal.clear": "Practice history cleared",
  "answer.pin": "Answer pinned",
  "answer.suppress": "Item hidden for a question",
  "answer.correct": "Answer written in your own words",
  "answer.rule_remove": "Answer rule removed",
  "share.grant": "Item shared with a recipient",
  "share.revoke": "Stopped sharing an item",
  "share.revoke_all": "Stopped sharing everything with a recipient",
  "share.set": "Sharing changed",
  "shared.view": "A recipient opened what you shared",
  "shared.media_play": "A recipient played a recording you shared",
  "answer.recipient": "A recipient asked a question (answered from your shared items)",
  "answer.report": "A recipient reported an answer",
  "answer.report_resolve": "Report marked as dealt with",
};

const REASON_LABEL: Record<string, string> = {
  mfa_required: "second factor not confirmed",
  consent_required: "consent missing",
  not_found: "not permitted",
  email_mismatch: "signed in with a different email address",
  consent_withdrawn: "because you withdrew sharing consent",
  author_revoked: "by you",
  minor_not_invitable: "children cannot be invited",
  already_used: "link already used",
  unknown_token: "link not recognised",
  expired: "link expired",
  revoked: "link was cancelled",
  own_legacy: "authors cannot accept their own invitation",
  superseded: "replaced by a newer link",
  edited: "because the words changed",
  media_added: "because a recording or photo was added",
  media_removed: "because a recording or photo was removed",
  author_withdrew: "by you",
  stale_version: "changed in another window",
  legacy_locked: "legacy not open for changes",
  storage_full: "storage limit reached",
  answers_off: "answers are switched off",
  legacy_not_active: "legacy not active",
};

/** The author's transparency log: who did what, when. Identifiers only, never content. */
export default async function Activity() {
  const ctx = await requireSession("/legacy/activity");
  const o = await getOverview(ctx);
  if (!o.legacy) redirect("/home");
  const log = await getAuditLog(ctx, o.legacy.id);
  return (
    <>
      <h1>Activity log</h1>
      <p className="muted">Everything important that happened to your legacy, including attempts that were refused. It records actions, not the content of your memories.</p>
      <div className="card">
        <table>
          <thead><tr><th>When</th><th>What</th><th>By</th><th>Result</th></tr></thead>
          <tbody>
            {log.map((e) => {
              const purpose = typeof e.detail.purpose === "string" ? CONSENT_LABELS[e.detail.purpose] : null;
              const reason = typeof e.detail.reason === "string" ? REASON_LABEL[e.detail.reason] ?? e.detail.reason : null;
              return (
                <tr key={e.id}>
                  <td className="small">{formatDateTime(e.occurredAt)}</td>
                  <td>{ACTION_LABEL[e.action] ?? e.action}{purpose && <div className="muted small">{purpose}{e.detail.version ? ` · v${e.detail.version}` : ""}</div>}</td>
                  <td>{e.byYou ? "You" : "Someone else"}</td>
                  <td>
                    <span className={`pill ${e.outcome === "success" ? "good" : "warn"}`}>{e.outcome === "success" ? "Done" : "Refused"}</span>
                    {reason && <div className="muted small">{reason}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
