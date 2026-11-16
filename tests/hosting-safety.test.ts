/**
 * Hosting safety (DR-053 conditions): the hosted app runs with least privilege and can never expose
 * the development sign-in.
 */
import pg from "pg";
import { describe, expect, it } from "vitest";
import { authMode } from "../src/server/auth-mode";
import { storageBackend } from "../src/server/storage";
import { addMedia, createMemory, readMedia } from "../src/domain/vault";
import { useTempBlobStore, wav } from "./fixtures";
import { setPool } from "../src/server/db";
import { addRecipient, createLegacy, getOverview, provisionAccount } from "../src/domain/onboarding";
import { PolicyError, ValidationError } from "../src/domain/errors";
import { makePerson, useFreshDatabase } from "./helpers";
import { dbUrl } from "./db-urls";

const ownerPool = useFreshDatabase();
useTempBlobStore();

describe("Development sign-in cannot run when hosted", () => {
  it("is refused on Vercel or when ECHO_HOSTED is set, whatever AUTH_MODE says", () => {
    expect(authMode({ AUTH_MODE: "dev" })).toBe("dev");
    expect(authMode({ AUTH_MODE: "dev", VERCEL: "1" })).toBe("unconfigured");
    expect(authMode({ AUTH_MODE: "dev", ECHO_HOSTED: "1" })).toBe("unconfigured");
    expect(authMode({})).toBe("unconfigured");
  });

  it("local-disk media storage is refused on a hosted deployment", () => {
    expect(storageBackend({})).toBe("local");
    expect(storageBackend({ VERCEL: "1" })).toBe("unconfigured");
    expect(storageBackend({ ECHO_HOSTED: "1", STORAGE_BACKEND: "local" })).toBe("unconfigured");
    expect(storageBackend({ STORAGE_BACKEND: "supabase" })).toBe("unconfigured"); // not built yet: never a silent fallback
  });
});

describe("Least-privilege runtime login (echo_app_login)", () => {
  function loginPool() {
    const dbName = new URL(ownerPool().options.connectionString as string).pathname.slice(1);
    const u = new URL(dbUrl(dbName));
    u.username = "echo_app_login";
    return new pg.Pool({ connectionString: u.toString(), max: 3 });
  }

  it("has no table access at all without SET ROLE echo_app", async () => {
    const p = loginPool();
    try {
      for (const t of ["account", "legacy", "recipient", "consent_event", "audit_event", "consent_document",
                       "memory_item", "memory_version", "media_asset", "transcript", "transcript_version", "memory_tag", "memory_audience", "citable_source"]) {
        await expect(p.query(`select 1 from ${t} limit 1`)).rejects.toThrow(/permission denied/);
      }
      await expect(p.query("select * from app.provision_account('x','x@example.test','x')")).rejects.toThrow(/permission denied/);
    } finally {
      await p.end();
    }
  });

  it("runs the whole onboarding flow without owner credentials", async () => {
    const p = loginPool();
    setPool(p);
    try {
      const { accountId, created } = await provisionAccount({ authSubject: "lp|1", email: "lp1@example.test", displayName: "LP" });
      expect(created).toBe(true);
      expect((await provisionAccount({ authSubject: "lp|1", email: "lp1@example.test", displayName: "LP" })).accountId).toBe(accountId);
      await expect(provisionAccount({ authSubject: "lp|2", email: "LP1@example.test", displayName: "Other" })).rejects.toBeInstanceOf(PolicyError);
      await expect(provisionAccount({ authSubject: "lp|3", email: "not-an-email", displayName: "x" })).rejects.toBeInstanceOf(ValidationError);

      setPool(ownerPool()); // consents via helper (uses owner only to look up document ids)
      const author = await makePerson("lpauthor");
      setPool(p);
      const { legacyId } = await createLegacy(author, { title: "T", authorDisplayName: "Me" });
      await addRecipient(author, legacyId, { displayName: "A", relationship: "child", isMinor: false });
      expect((await getOverview(author)).legacy?.recipients).toHaveLength(1);
      setPool(ownerPool());
      const voice = await makePerson("lpvoice", ["terms_of_service", "privacy_notice", "audio_recording"]);
      setPool(p);
      const { legacyId: l2 } = await createLegacy(voice, { title: "V", authorDisplayName: "V" });
      const { memoryId } = await createMemory(voice, l2, { kind: "memory", title: "Voice", body: "words", approve: true });
      const audio = wav();
      const { assetId } = await addMedia(voice, l2, memoryId, { bytes: audio, capture: "browser_recording" });
      expect(Buffer.compare((await readMedia(voice, assetId)).bytes, audio)).toBe(0);
    } finally {
      setPool(ownerPool());
      await p.end();
    }
  });
});

describe("Export download accepts only same-site posts", () => {
  it("uses Sec-Fetch-Site, falls back to Origin, and never throws on 'Origin: null'", async () => {
    const { isSameOrigin } = await import("../src/server/same-origin");
    const h = (o: Record<string, string>) => new Headers(o);
    expect(isSameOrigin(h({ "sec-fetch-site": "same-origin", origin: "null", host: "localhost:3000" }))).toBe(true);
    expect(isSameOrigin(h({ "sec-fetch-site": "cross-site", origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(h({ "sec-fetch-site": "same-site", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
    expect(isSameOrigin(h({ origin: "https://evil.example", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "null", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(h({ origin: "not a url", host: "localhost:3000" }))).toBe(false);
    expect(isSameOrigin(h({}))).toBe(false);
  });
});
