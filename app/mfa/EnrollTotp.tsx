"use client";

import { useActionState } from "react";
import { startTotpEnrollment, verifyTotpCode, type EnrollState } from "../auth-actions";

/** Authenticator-app setup (ADR-015): the QR code and secret are shown once, here only. */
export function EnrollTotp({ next }: { next: string }) {
  const [state, action, pending] = useActionState<EnrollState, FormData>(startTotpEnrollment, {});
  if (!state.factorId) {
    return (
      <form action={action}>
        {state.error && <p className="notice error small" role="alert">{state.error}</p>}
        <p>Set up an authenticator app (for example Google Authenticator, Microsoft Authenticator or 1Password) once. After that, it gives you a new 6-digit code every 30 seconds.</p>
        <div className="actions">
          <button type="submit" disabled={pending}>{pending ? "Preparing…" : "Set up an authenticator app"}</button>
        </div>
      </form>
    );
  }
  return (
    <form action={verifyTotpCode}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="factorId" value={state.factorId} />
      <p>1. Scan this code with your authenticator app.</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state.qrCode} alt="QR code to add Echo of Me to your authenticator app" className="qr" width={200} height={200} />
      <p className="small">Cannot scan? Enter this key in the app instead: <code className="mono" data-testid="totp-secret">{state.secret}</code></p>
      <label htmlFor="code">2. Enter the 6-digit code it shows</label>
      <input id="code" name="code" type="text" inputMode="numeric" pattern="[0-9 ]{6,7}" autoComplete="one-time-code" required />
      <div className="actions"><button type="submit">Confirm</button></div>
    </form>
  );
}
