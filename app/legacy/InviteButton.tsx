"use client";

import Link from "next/link";
import { useActionState } from "react";
import { inviteAction, type InviteState } from "../actions";

/** Creates an invitation and shows the one-time link here only (email sending is not connected yet). */
export function InviteButton({ legacyId, recipientId, label }: { legacyId: string; recipientId: string; label: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteAction, {});
  return (
    <div>
      <form action={action}>
        <input type="hidden" name="legacyId" value={legacyId} />
        <input type="hidden" name="recipientId" value={recipientId} />
        <button className="secondary" type="submit" disabled={pending}>
          {pending ? "Creating…" : label}
        </button>
      </form>
      {state.error && (
        <p className="notice error small" role="alert">
          {state.error} {state.needsMfa && <Link href="/mfa?next=/legacy">Confirm your second factor</Link>}
        </p>
      )}
      {state.link && (
        <div className="notice ok small" role="status">
          <p className="flush">
            Invitation created. Email sending is not connected in this build, so copy this one-time link and send it
            yourself. It works once, only for the email address you entered, and expires on{" "}
            {new Date(state.expiresAt!).toLocaleDateString("en-ZA")}. It will not be shown again.
          </p>
          <p className="mono">{state.link}</p>
        </div>
      )}
    </div>
  );
}
