"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { closeAccount, leaveLegacy } from "../src/domain/account";
import { DomainError, ValidationError } from "../src/domain/errors";
import { clearSession, requireSession } from "../src/server/session";

function messageFor(err: unknown): string {
  if (err instanceof ValidationError) {
    const first = Object.values(err.fields)[0];
    return first && first !== err.message ? `${err.message} ${first}` : err.message;
  }
  if (err instanceof DomainError) return err.message;
  console.error(err);
  return "Something went wrong. Nothing was changed.";
}

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");
const back = (kind: "ok" | "error", message: string, hash = ""): never =>
  redirect(`/account?${kind}=${encodeURIComponent(message)}${hash ? `#${hash}` : ""}`);

/** A recipient leaves a legacy they were invited to (ADR-013). */
export async function submitLeaveLegacy(fd: FormData) {
  const ctx = await requireSession("/account");
  if (fd.get("understand") !== "on") back("error", "Please tick the box to confirm that you want to leave.", "memberships");
  try {
    await leaveLegacy(ctx, str(fd, "legacyId"));
  } catch (err) {
    back("error", messageFor(err), "memberships");
  }
  revalidatePath("/home");
  back("ok", "You left that legacy. Your access ended and the questions you asked there were deleted.", "memberships");
}

/** Closes the signed-in account, then signs out (ADR-013). */
export async function submitCloseAccount(fd: FormData) {
  const ctx = await requireSession("/account");
  if (fd.get("understand") !== "on") back("error", "Please tick the box to confirm that you understand.", "close");
  try {
    await closeAccount(ctx, str(fd, "confirmEmail"));
  } catch (err) {
    if (err instanceof DomainError && err.code === "mfa_required") redirect("/mfa?next=/account");
    back("error", messageFor(err), "close");
  }
  await clearSession();
  redirect(`/sign-in?ok=${encodeURIComponent("Your account was closed. Your name and email address were removed.")}`);
}
