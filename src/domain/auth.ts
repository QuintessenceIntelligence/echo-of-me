import { MfaRequiredError } from "./errors";

/**
 * Who is acting. Produced by the identity layer (ADR-004) from a verified session, never from user input.
 * aal = authenticator assurance level: aal1 = password/magic link only; aal2 = second factor verified.
 */
export interface AuthContext {
  accountId: string;
  aal: "aal1" | "aal2";
}

/** Sensitive actions (inviting people, changing consents) require a verified second factor. */
export function requireMfa(ctx: AuthContext): void {
  if (ctx.aal !== "aal2") throw new MfaRequiredError();
}
