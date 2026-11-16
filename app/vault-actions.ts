"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DomainError, ValidationError } from "../src/domain/errors";
import {
  addMedia,
  addTag,
  createMemory,
  decideTag,
  deleteMedia,
  deleteMemory,
  editMemory,
  removeTag,
  saveTranscript,
  setAudience,
  setMemoryApproval,
  setSensitivity,
  setTranscriptApproval,
  suggestTags,
} from "../src/domain/vault";
import { readSession, requireSession } from "../src/server/session";

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
const num = (fd: FormData, k: string) => Number.parseInt(str(fd, k), 10);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function itemPath(fd: FormData, hash = ""): string {
  const id = str(fd, "memoryId");
  return UUID_RE.test(id) ? `/legacy/memories/${id}${hash}` : "/legacy/memories";
}

function go(path: string, kind: "ok" | "error", message: string): never {
  const [p, hash] = path.split("#");
  redirect(`${p}?${kind}=${encodeURIComponent(message)}${hash ? `#${hash}` : ""}`);
}

/** Runs a vault change for the signed-in author, then returns to the page with a plain-language notice. */
async function run(fd: FormData, okMessage: string, fn: (ctx: Awaited<ReturnType<typeof requireSession>>) => Promise<unknown>, hash = "") {
  const ctx = await requireSession(itemPath(fd));
  try {
    await fn(ctx);
  } catch (err) {
    go(itemPath(fd, hash), "error", messageFor(err));
  }
  revalidatePath("/legacy/memories");
  go(itemPath(fd, hash), "ok", okMessage);
}

export async function submitCreateMemory(fd: FormData) {
  const ctx = await requireSession("/legacy/memories");
  const approve = str(fd, "intent") === "approve";
  let memoryId = "";
  try {
    ({ memoryId } = await createMemory(ctx, str(fd, "legacyId"), {
      kind: str(fd, "kind") as never,
      title: str(fd, "title"),
      body: str(fd, "body"),
      occurredLabel: str(fd, "occurredLabel"),
      sensitivity: fd.get("sensitive") === "on" ? "sensitive" : "standard",
      approve,
    }));
  } catch (err) {
    go("/legacy/memories#add", "error", messageFor(err));
  }
  revalidatePath("/legacy/memories");
  go(`/legacy/memories/${memoryId}`, "ok", approve ? "Saved and approved." : "Saved as a draft. Only approved items can ever be used in answers.");
}

export async function submitEditMemory(fd: FormData) {
  const approve = str(fd, "intent") === "approve";
  await run(fd, approve ? "New version saved and approved." : "Saved. This item is now a draft until you approve it.", (ctx) =>
    editMemory(ctx, str(fd, "legacyId"), str(fd, "memoryId"), {
      expectedVersion: num(fd, "expectedVersion"),
      title: str(fd, "title"),
      body: str(fd, "body"),
      occurredLabel: str(fd, "occurredLabel"),
      approve,
    }),
  );
}

export async function submitApproval(fd: FormData) {
  const approve = str(fd, "approve") === "yes";
  await run(fd, approve ? "Approved." : "Approval withdrawn. This item will not be used in answers.", (ctx) =>
    setMemoryApproval(ctx, str(fd, "legacyId"), str(fd, "memoryId"), approve, num(fd, "expectedVersion")),
  );
}

export async function submitSensitivity(fd: FormData) {
  await run(fd, "Sensitivity updated.", (ctx) =>
    setSensitivity(ctx, str(fd, "legacyId"), str(fd, "memoryId"), fd.get("sensitive") === "on" ? "sensitive" : "standard"), "#settings");
}

export async function submitAudience(fd: FormData) {
  await run(fd, "Saved who this is for. Nothing has been shared.", (ctx) =>
    setAudience(ctx, str(fd, "legacyId"), str(fd, "memoryId"), fd.getAll("recipientId").filter((v): v is string => typeof v === "string")), "#settings");
}

export async function submitDeleteMemory(fd: FormData) {
  const ctx = await requireSession(itemPath(fd));
  if (fd.get("confirm") !== "on") go(itemPath(fd, "#delete"), "error", "Please tick the box to confirm permanent deletion.");
  try {
    await deleteMemory(ctx, str(fd, "legacyId"), str(fd, "memoryId"));
  } catch (err) {
    if (err instanceof DomainError && err.code === "mfa_required") {
      redirect(`/mfa?next=${encodeURIComponent(itemPath(fd, "#delete"))}`);
    }
    go(itemPath(fd, "#delete"), "error", messageFor(err));
  }
  revalidatePath("/legacy/memories");
  go("/legacy/memories", "ok", "Deleted permanently, including every version and recording.");
}

// ---------------------------------------------------------------- recordings and photos

export type UploadState = { ok?: string; error?: string };

/** Used by the recorder and the upload form (client components). Returns a state instead of redirecting. */
export async function uploadMediaAction(_prev: UploadState, fd: FormData): Promise<UploadState> {
  const ctx = await readSession();
  if (!ctx) return { error: "Please sign in again." };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Please choose a file or make a recording first." };
  const capture = str(fd, "capture") === "browser_recording" ? "browser_recording" : "upload";
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await addMedia(ctx, str(fd, "legacyId"), str(fd, "memoryId"), { bytes, filename: file.name, capture });
  } catch (err) {
    return { error: messageFor(err) };
  }
  revalidatePath(itemPath(fd));
  return { ok: capture === "browser_recording" ? "Recording saved exactly as recorded." : "File saved exactly as uploaded." };
}

export async function submitDeleteMedia(fd: FormData) {
  await run(fd, "Recording deleted.", (ctx) => deleteMedia(ctx, str(fd, "legacyId"), str(fd, "assetId")), "#media");
}

export async function submitTranscript(fd: FormData) {
  const approve = str(fd, "intent") === "approve";
  await run(fd, approve ? "Transcript saved and approved." : "Transcript saved. It stays unapproved until you approve it.", (ctx) =>
    saveTranscript(ctx, str(fd, "legacyId"), str(fd, "assetId"), { text: str(fd, "text"), expectedVersion: num(fd, "expectedVersion"), approve }), "#media");
}

export async function submitTranscriptApproval(fd: FormData) {
  const approve = str(fd, "approve") === "yes";
  await run(fd, approve ? "Transcript approved." : "Transcript approval withdrawn.", (ctx) =>
    setTranscriptApproval(ctx, str(fd, "legacyId"), str(fd, "assetId"), approve, num(fd, "expectedVersion")), "#media");
}

// ---------------------------------------------------------------- tags

export async function submitAddTag(fd: FormData) {
  await run(fd, "Tag added.", (ctx) =>
    addTag(ctx, str(fd, "legacyId"), str(fd, "memoryId"), { kind: str(fd, "kind") as never, label: str(fd, "label") }), "#tags");
}

export async function submitRemoveTag(fd: FormData) {
  await run(fd, "Tag removed.", (ctx) => removeTag(ctx, str(fd, "legacyId"), str(fd, "tagId")), "#tags");
}

export async function submitSuggestTags(fd: FormData) {
  const ctx = await requireSession(itemPath(fd));
  let n = 0;
  try {
    n = (await suggestTags(ctx, str(fd, "legacyId"), str(fd, "memoryId"))).suggested.length;
  } catch (err) {
    go(itemPath(fd, "#tags"), "error", messageFor(err));
  }
  go(itemPath(fd, "#tags"), "ok", n ? `${n} theme suggestion(s) added for you to review.` : "No new themes found.");
}

export async function submitDecideTag(fd: FormData) {
  const decision = str(fd, "decision") === "approved" ? "approved" : "rejected";
  await run(fd, decision === "approved" ? "Suggestion accepted." : "Suggestion rejected.", (ctx) =>
    decideTag(ctx, str(fd, "legacyId"), str(fd, "tagId"), decision), "#tags");
}
