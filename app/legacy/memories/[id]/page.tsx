import Link from "next/link";
import { redirect } from "next/navigation";
import { getOverview } from "../../../../src/domain/onboarding";
import { getMemory } from "../../../../src/domain/vault";
import { getItemSharing } from "../../../../src/domain/sharing";
import { nextPrompts } from "../../../../src/domain/prompts";
import { DomainError } from "../../../../src/domain/errors";
import { requireSession } from "../../../../src/server/session";
import { formatDateTime, Notices } from "../../../components";
import {
  submitAddTag,
  submitApproval,
  submitAudience,
  submitDecideTag,
  submitDeleteMedia,
  submitDeleteMemory,
  submitEditMemory,
  submitRemoveTag,
  submitSensitivity,
  submitShares,
  submitSuggestTags,
  submitTranscript,
  submitTranscriptApproval,
} from "../../../vault-actions";
import { ApprovalPill, formatBytes, KIND_LABEL, ProvenanceBadge } from "../ui";
import { MediaCapture } from "./MediaCapture";

const TAG_KIND_LABEL: Record<string, string> = { theme: "Theme", person: "Person", value: "Value" };

export default async function MemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireSession(`/legacy/memories/${id}`);
  const o = await getOverview(ctx);
  if (!o.legacy) redirect("/home");
  let m;
  try {
    m = await getMemory(ctx, o.legacy.id, id);
  } catch (err) {
    if (err instanceof DomainError) redirect(`/legacy/memories?error=${encodeURIComponent("That item could not be found.")}`);
    throw err;
  }
  const consent = (p: string) => o.consents.find((c) => c.purpose === p)?.state === "granted";
  const sharing = await getItemSharing(ctx, o.legacy.id, m.id);
  const next = m.prompt ? await nextPrompts(ctx, o.legacy.id, m.prompt.id) : [];
  const ELIGIBILITY_NOTE: Record<string, string> = {
    minor: "child, record only",
    not_invited: "invite them first",
    revoked: "invitation cancelled",
    left: "left, invite them again first",
  };
  const hidden = (
    <>
      <input type="hidden" name="legacyId" value={m.legacyId} />
      <input type="hidden" name="memoryId" value={m.id} />
    </>
  );
  const approvedTags = m.tags.filter((t) => t.state === "approved");
  const suggested = m.tags.filter((t) => t.state === "suggested");
  const rejected = m.tags.filter((t) => t.state === "rejected");

  return (
    <>
      <p className="small"><Link href="/legacy/memories">← All memories and values</Link></p>
      <h1>{m.current.title}</h1>
      <div className="item-meta">
        <span className="pill">{KIND_LABEL[m.kind]}</span>
        <ApprovalPill approval={m.approval} />
        {m.sensitivity === "sensitive" && <span className="pill warn">Sensitive</span>}
        <span className="muted small">Version {m.currentVersion}{m.current.occurredLabel ? ` · ${m.current.occurredLabel}` : ""}</span>
      </div>
      <Notices searchParams={sp} />
      {m.prompt && (
        <p className="muted small">
          Answers the prompt: “{m.prompt.text}”
          {next.length > 0 && <> · Next in this theme: {next.map((n, i) => <span key={n.id}>{i ? " · " : ""}<Link href={`/legacy/memories?prompt=${n.id}#add`}>{n.text}</Link></span>)}</>}
        </p>
      )}

      <section className="card" aria-labelledby="approval-h">
        <h2 id="approval-h">Approval</h2>
        {m.approval === "approved" ? (
          <>
            <p>
              You approved version {m.currentVersion} on {formatDateTime(m.approvedAt!)}. When answers are switched on in a later
              version, only approved material like this can be used, and always with a reference back to it.
            </p>
            <form action={submitApproval}>
              {hidden}
              <input type="hidden" name="expectedVersion" value={m.currentVersion} />
              <input type="hidden" name="approve" value="no" />
              <button type="submit" className="secondary">Withdraw approval</button>
            </form>
          </>
        ) : (
          <>
            <p>This is a draft. It is kept safely but will never be used to answer questions until you approve it. Any later change returns it to draft.</p>
            <form action={submitApproval}>
              {hidden}
              <input type="hidden" name="expectedVersion" value={m.currentVersion} />
              <input type="hidden" name="approve" value="yes" />
              <button type="submit">Approve version {m.currentVersion}</button>
            </form>
          </>
        )}
      </section>

      <section className="card" id="words" aria-labelledby="words-h">
        <h2 id="words-h">Your words <ProvenanceBadge p={m.textProvenance} /></h2>
        {m.current.body ? <div className="memory-body">{m.current.body}</div> : <p className="muted">No written words yet.</p>}
        <details>
          <summary>Edit (saves a new version; earlier versions are kept)</summary>
          <form action={submitEditMemory}>
            {hidden}
            <input type="hidden" name="expectedVersion" value={m.currentVersion} />
            <label htmlFor="e-title">Title</label>
            <input id="e-title" name="title" type="text" required maxLength={160} defaultValue={m.current.title} />
            <label htmlFor="e-when">When did this happen? (optional)</label>
            <input id="e-when" name="occurredLabel" type="text" maxLength={80} defaultValue={m.current.occurredLabel ?? ""} />
            <label htmlFor="e-body">In your own words</label>
            <textarea id="e-body" name="body" maxLength={20000} rows={8} defaultValue={m.current.body} />
            <div className="actions">
              <button type="submit" name="intent" value="draft" className="secondary">Save new version as draft</button>
              <button type="submit" name="intent" value="approve">Save and approve</button>
            </div>
          </form>
        </details>
        {m.versions.length > 1 && (
          <details>
            <summary>Earlier versions ({m.versions.length - 1})</summary>
            <ol className="versions" reversed>
              {m.versions.filter((v) => v.versionNo !== m.currentVersion).map((v) => (
                <li key={v.versionNo}>
                  <div className="muted small">Version {v.versionNo} · {formatDateTime(v.createdAt)} · {v.title}</div>
                  <div className="memory-body small">{v.body || "(no words)"}</div>
                </li>
              ))}
            </ol>
          </details>
        )}
      </section>

      <section className="card" id="media" aria-labelledby="media-h">
        <h2 id="media-h">Recordings and photos</h2>
        <p className="muted small">Originals are kept exactly as you made them and checked against their fingerprint every time they are played or exported. Echo of Me never creates a synthetic copy of your voice.</p>
        {m.media.map((a, idx) => (
          <div className="media-item" key={a.id}>
            <div className="item-meta">
              <ProvenanceBadge p={a.provenance} />
              <span className="muted small">
                {a.capture === "browser_recording" ? "Recorded here" : "Uploaded"} · {formatBytes(a.byteSize)} · {formatDateTime(a.createdAt)}
                {a.originalFilename ? ` · ${a.originalFilename}` : ""}
              </span>
            </div>
            {a.kind === "audio" ? (
              <audio controls preload="none" src={`/media/${a.id}`} aria-label={`Recording ${idx + 1}`} />
            ) : (
              <img src={`/media/${a.id}`} alt={`Photo ${idx + 1} for “${m.current.title}”`} className="media-photo" />
            )}
            <div className="mono muted">sha256 {a.sha256}</div>

            {a.kind === "audio" && (
              <div className="transcript">
                <h3>
                  Transcript{" "}
                  {a.transcript ? <ProvenanceBadge p={a.transcript.provenance} /> : <span className="pill">None yet</span>}
                </h3>
                {a.transcript && (
                  <p className="muted small">
                    Version {a.transcript.currentVersion}, {a.transcript.origin === "machine" ? "made by a machine" : "typed by you"}
                    {a.transcript.approvedAt ? `, approved ${formatDateTime(a.transcript.approvedAt)}` : ", not approved"}.
                  </p>
                )}
                <form action={submitTranscript}>
                  {hidden}
                  <input type="hidden" name="assetId" value={a.id} />
                  <input type="hidden" name="expectedVersion" value={a.transcript?.currentVersion ?? 0} />
                  <label htmlFor={`t-${a.id}`}>{a.transcript ? "Correct the transcript" : "Type what you said (automatic transcription is not switched on yet)"}</label>
                  <textarea id={`t-${a.id}`} name="text" rows={4} maxLength={100000} defaultValue={a.transcript?.text ?? ""} required />
                  <div className="actions">
                    <button type="submit" name="intent" value="draft" className="secondary">Save transcript</button>
                    <button type="submit" name="intent" value="approve">Save and approve transcript</button>
                  </div>
                </form>
                {a.transcript && (
                  <form action={submitTranscriptApproval}>
                    {hidden}
                    <input type="hidden" name="assetId" value={a.id} />
                    <input type="hidden" name="expectedVersion" value={a.transcript.currentVersion} />
                    <input type="hidden" name="approve" value={a.transcript.approval === "approved" ? "no" : "yes"} />
                    <button type="submit" className="link small">
                      {a.transcript.approval === "approved" ? "Withdraw transcript approval" : `Approve transcript version ${a.transcript.currentVersion} as it is`}
                    </button>
                  </form>
                )}
              </div>
            )}
            <form action={submitDeleteMedia}>
              {hidden}
              <input type="hidden" name="assetId" value={a.id} />
              <button type="submit" className="link small">Delete this {a.kind === "audio" ? "recording" : "photo"}</button>
            </form>
          </div>
        ))}
        <MediaCapture legacyId={m.legacyId} memoryId={m.id} audioAllowed={consent("audio_recording")} />
      </section>

      <section className="card" id="tags" aria-labelledby="tags-h">
        <h2 id="tags-h">Tags</h2>
        {approvedTags.length > 0 ? (
          <ul className="tag-list">
            {approvedTags.map((t) => (
              <li key={t.id}>
                <span className="tag">{TAG_KIND_LABEL[t.kind]}: {t.label}</span>
                <form action={submitRemoveTag}>
                  {hidden}
                  <input type="hidden" name="tagId" value={t.id} />
                  <button type="submit" className="link small" aria-label={`Remove tag ${t.label}`}>Remove</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">No tags yet.</p>
        )}
        {suggested.length > 0 && (
          <>
            <h3>Suggestions to review <ProvenanceBadge p="P6_unapproved_machine_output" /></h3>
            <ul className="tag-list">
              {suggested.map((t) => (
                <li key={t.id}>
                  <span className="tag suggested">{TAG_KIND_LABEL[t.kind]}: {t.label}</span>
                  <form action={submitDecideTag}>
                    {hidden}
                    <input type="hidden" name="tagId" value={t.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <button type="submit" className="link small" aria-label={`Accept suggestion ${t.label}`}>Accept</button>
                  </form>
                  <form action={submitDecideTag}>
                    {hidden}
                    <input type="hidden" name="tagId" value={t.id} />
                    <input type="hidden" name="decision" value="rejected" />
                    <button type="submit" className="link small" aria-label={`Reject suggestion ${t.label}`}>Reject</button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
        {rejected.length > 0 && <p className="muted small">Rejected suggestions (not suggested again): {rejected.map((t) => t.label).join(", ")}</p>}
        <div className="row">
          <form action={submitAddTag} className="inline-form">
            {hidden}
            <div>
              <label htmlFor="tag-kind">Tag type</label>
              <select id="tag-kind" name="kind" defaultValue="theme">
                <option value="theme">Theme</option>
                <option value="person">Person</option>
                <option value="value">Value</option>
              </select>
            </div>
            <div>
              <label htmlFor="tag-label">Tag</label>
              <input id="tag-label" name="label" type="text" required maxLength={60} />
            </div>
            <div><button type="submit" className="secondary">Add tag</button></div>
          </form>
        </div>
        {consent("ai_processing") ? (
          <form action={submitSuggestTags}>
            {hidden}
            <div className="actions"><button type="submit" className="secondary">Suggest themes automatically</button></div>
            <p className="muted small">Uses a simple list of keywords inside Echo of Me. It is not AI and sends nothing anywhere. Suggestions wait for your decision.</p>
          </form>
        ) : (
          <p className="muted small">Automatic suggestions need the “AI processing” consent, which you have not given. You can add tags yourself.</p>
        )}
      </section>

      <section className="card" id="settings" aria-labelledby="settings-h">
        <h2 id="settings-h">Who this is for, and sensitivity</h2>
        <form action={submitAudience}>
          {hidden}
          <fieldset className="plain">
            <legend>Intended for</legend>
            {m.recipients.length === 0 && <p className="muted small">You have not added any recipients yet.</p>}
            {m.recipients.map((r) => (
              <label className="check" key={r.id}>
                <input type="checkbox" name="recipientId" value={r.id} defaultChecked={m.audienceRecipientIds.includes(r.id)} /> {r.displayName}
                {r.isMinor && <span className="muted small"> (child, record only)</span>}
              </label>
            ))}
          </fieldset>
          <p className="notice info small">This records your intention only. Nobody can see anything yet: sharing will arrive in a later version and will always need your explicit step.</p>
          <div className="actions"><button type="submit" className="secondary">Save who this is for</button></div>
        </form>
        <form action={submitSensitivity}>
          {hidden}
          <label className="check"><input type="checkbox" name="sensitive" defaultChecked={m.sensitivity === "sensitive"} /> This is sensitive (handle with extra care)</label>
          <div className="actions"><button type="submit" className="secondary">Save sensitivity</button></div>
        </form>
      </section>

      <section className="card" id="share" aria-labelledby="share-h">
        <h2 id="share-h">Share</h2>
        {!consent("share_with_recipients") ? (
          <p className="notice info small">Sharing needs the “Inviting and sharing with recipients” consent under <Link href="/legacy#consents">Your consents</Link>.</p>
        ) : o.legacy.state !== "active" ? (
          <p className="notice info small">Finish setting up your legacy before sharing.</p>
        ) : !sharing.approved && !sharing.targets.some((t) => t.shared) ? (
          <p className="notice info small">Approve this item before sharing it. Only approved items can be shared.</p>
        ) : sharing.targets.length === 0 ? (
          <p className="muted small">Add and invite recipients on your <Link href="/legacy#recipients">legacy page</Link> first.</p>
        ) : (
          <form action={submitShares}>
            {hidden}
            {!sharing.approved && <p className="notice info small">This item is a draft, so nobody can see it right now. It becomes visible again to the people below when you approve it.</p>}
            <fieldset className="plain">
              <legend>Who can see this item and ask about it</legend>
              {sharing.targets.map((t) => (
                <label className="check" key={t.recipientId}>
                  <input type="checkbox" name="recipientId" value={t.recipientId} defaultChecked={t.shared} disabled={t.eligibility !== "ok" && !t.shared} />{" "}
                  {t.displayName}
                  {t.eligibility !== "ok" && <span className="muted small"> ({ELIGIBILITY_NOTE[t.eligibility]})</span>}
                  {t.eligibility === "ok" && t.invitationStatus === "invited" && <span className="muted small"> (sees it once they accept the invitation)</span>}
                  {t.shared && t.grantedAt && <span className="muted small"> · shared {formatDateTime(t.grantedAt)}</span>}
                </label>
              ))}
            </fieldset>
            {sharing.sensitive && (
              <label className="check"><input type="checkbox" name="confirmSensitive" /> This item is marked sensitive. I still want to share it with the people ticked above.</label>
            )}
            <p className="muted small">They will see your current approved words, recordings and approved transcripts, never drafts or earlier versions. If you change the item, they stop seeing it until you approve it again. Sharing needs your second sign-in step.</p>
            <div className="actions"><button type="submit">Save sharing</button></div>
          </form>
        )}
      </section>

      <section className="card" id="delete" aria-labelledby="delete-h">
        <h2 id="delete-h">Delete</h2>
        <p className="muted small">Deleting removes this item, every version, recording, photo, transcript and tag permanently. The activity log keeps a record that something was deleted, not what it said. Consider exporting first.</p>
        <form action={submitDeleteMemory}>
          {hidden}
          <label className="check"><input type="checkbox" name="confirm" required /> I understand this cannot be undone</label>
          <div className="actions"><button type="submit" className="danger">Delete permanently</button></div>
        </form>
      </section>
    </>
  );
}
