"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DomainError, ValidationError } from "../src/domain/errors";
import { CONSENT_PURPOSES, giveConsent, withdrawConsent, type ConsentPurpose } from "../src/domain/consent";
import {
  acceptInvitation,
  addRecipient,
  addTrustedContact,
  completeOnboarding,
  createLegacy,
  inviteRecipient,
  provisionAccount,
  removeRecipient,
  revokeInvitation,
} from "../src/domain/onboarding";
import { authMode, clearSession, readProviderSession, readSession, requireSession, writeSession } from "../src/server/session";
import { goTrue } from "../src/server/supabase-auth";

function safeNext(v: FormDataEntryValue | null, fallback = "/home"): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : fallback;
}

function messageFor(err: unknown): string {
  if (err instanceof ValidationError) {
    const first = Object.values(err.fields)[0];
    return first ? `${err.message} ${first}` : err.message;
  }
  if (err instanceof DomainError) return err.message;
  console.error(err);
  return "Something went wrong. Nothing was changed.";
}

function back(target: string, err: unknown): never {
  const [path, hash] = target.split("#");
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(messageFor(err))}${hash ? `#${hash}` : ""}`);
}

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

// ---------------------------------------------------------------- identity (development mode only)

export async function devSignIn(fd: FormData) {
  if (authMode() !== "dev") redirect("/sign-in");
  const email = str(fd, "email").trim().toLowerCase();
  const next = safeNext(fd.get("next"));
  let accountId: string;
  try {
    ({ accountId } = await provisionAccount({ authSubject: `dev|${email}`, email, displayName: str(fd, "displayName") || email.split("@")[0] }));
  } catch (err) {
    back(`/sign-in?next=${encodeURIComponent(next)}`, err);
  }
  await writeSession({ accountId, aal: "aal1" });
  redirect(next);
}

export async function devConfirmSecondFactor(fd: FormData) {
  if (authMode() !== "dev") redirect("/sign-in");
  const s = await requireSession();
  await writeSession({ accountId: s.accountId, aal: "aal2" });
  redirect(safeNext(fd.get("next")));
}

export async function signOut() {
  if (authMode() === "supabase") {
    const tokens = await readProviderSession();
    if (tokens) await goTrue().signOut(tokens.accessToken);
  }
  await clearSession();
  redirect("/");
}

// ---------------------------------------------------------------- consents

export async function submitOnboardingConsents(fd: FormData) {
  const ctx = await requireSession("/onboarding/consents");
  try {
    for (const purpose of CONSENT_PURPOSES) {
      if (fd.get(`consent:${purpose}`) === "on") {
        await giveConsent(ctx, { purpose, documentId: str(fd, `doc:${purpose}`) });
      }
    }
  } catch (err) {
    back("/onboarding/consents", err);
  }
  redirect("/home");
}

export async function giveOneConsent(fd: FormData) {
  const ctx = await requireSession("/legacy");
  try {
    await giveConsent(ctx, { purpose: str(fd, "purpose") as ConsentPurpose, documentId: str(fd, "documentId") });
  } catch (err) {
    back("/legacy", err);
  }
  revalidatePath("/legacy");
  redirect("/legacy?ok=Consent+recorded");
}

export async function withdrawOneConsent(fd: FormData) {
  const ctx = await requireSession("/legacy");
  let revoked = 0;
  try {
    ({ revokedInvitations: revoked } = await withdrawConsent(ctx, str(fd, "purpose") as ConsentPurpose));
  } catch (err) {
    back("/legacy", err);
  }
  revalidatePath("/legacy");
  redirect(`/legacy?ok=${encodeURIComponent(`Consent withdrawn.${revoked ? ` ${revoked} pending invitation(s) cancelled.` : ""}`)}`);
}

// ---------------------------------------------------------------- legacy, recipients, trusted contacts

export async function submitCreateLegacy(fd: FormData) {
  const ctx = await requireSession("/onboarding/legacy");
  try {
    await createLegacy(ctx, { title: str(fd, "title"), authorDisplayName: str(fd, "authorDisplayName"), about: str(fd, "about") });
  } catch (err) {
    back("/onboarding/legacy", err);
  }
  redirect("/legacy?ok=Your+legacy+has+been+created");
}

export async function submitFinishSetup(fd: FormData) {
  const ctx = await requireSession("/legacy");
  try {
    await completeOnboarding(ctx, str(fd, "legacyId"));
  } catch (err) {
    back("/legacy", err);
  }
  redirect("/legacy?ok=Setup+complete");
}

export async function submitAddRecipient(fd: FormData) {
  const ctx = await requireSession("/legacy");
  try {
    await addRecipient(ctx, str(fd, "legacyId"), {
      displayName: str(fd, "displayName"),
      relationship: str(fd, "relationship") as never,
      isMinor: str(fd, "ageGroup") === "minor",
      email: str(fd, "email"),
    });
  } catch (err) {
    back("/legacy#recipients", err);
  }
  redirect("/legacy?ok=Recipient+added.+They+can+see+nothing+until+you+share+something.#recipients");
}

export async function submitRemoveRecipient(fd: FormData) {
  const ctx = await requireSession("/legacy");
  try {
    await removeRecipient(ctx, str(fd, "legacyId"), str(fd, "recipientId"));
  } catch (err) {
    back("/legacy#recipients", err);
  }
  redirect("/legacy?ok=Recipient+removed#recipients");
}

export async function submitAddTrustedContact(fd: FormData) {
  const ctx = await requireSession("/legacy");
  try {
    await addTrustedContact(ctx, str(fd, "legacyId"), {
      displayName: str(fd, "displayName"),
      email: str(fd, "email"),
      relationship: str(fd, "relationship"),
    });
  } catch (err) {
    back("/legacy#trusted", err);
  }
  redirect("/legacy?ok=Trusted+contact+saved#trusted");
}

export async function submitRevokeInvitation(fd: FormData) {
  const ctx = await requireSession("/legacy");
  try {
    await revokeInvitation(ctx, str(fd, "legacyId"), str(fd, "recipientId"));
  } catch (err) {
    back("/legacy#recipients", err);
  }
  redirect("/legacy?ok=Invitation+cancelled#recipients");
}

export type InviteState = { link?: string; expiresAt?: string; error?: string; needsMfa?: boolean };

/** Returns the one-time link to the client component only; it is never put in a URL or a log. */
export async function inviteAction(_prev: InviteState, fd: FormData): Promise<InviteState> {
  const ctx = await readSession();
  if (!ctx) return { error: "Please sign in again." };
  try {
    const { token, expiresAt } = await inviteRecipient(ctx, str(fd, "legacyId"), str(fd, "recipientId"));
    const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
    revalidatePath("/legacy");
    return { link: `${base}/invite/${token}`, expiresAt: expiresAt.toISOString() };
  } catch (err) {
    return { error: messageFor(err), needsMfa: err instanceof DomainError && err.code === "mfa_required" };
  }
}

// ---------------------------------------------------------------- recipient side

export async function submitAcceptInvitation(fd: FormData) {
  const token = str(fd, "token");
  const ctx = await requireSession(`/invite/${token}`);
  try {
    await acceptInvitation(ctx, token, str(fd, "termsDocumentId"));
  } catch (err) {
    back(`/invite/${token}`, err);
  }
  redirect("/home?ok=You+have+joined");
}
