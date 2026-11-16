import { randomUUID } from "node:crypto";
import pg from "pg";
import { afterAll, beforeAll } from "vitest";
import { setPool } from "../src/server/db";
import type { AuthContext } from "../src/domain/auth";
import { currentDocuments, giveConsent, type ConsentPurpose } from "../src/domain/consent";
import { provisionAccount } from "../src/domain/onboarding";
import { withSystem } from "../src/server/db";
import { adminUrl, dbUrl, TEMPLATE_DB } from "./db-urls";

/** Gives the calling test file its own fresh database cloned from the migrated template. */
export function useFreshDatabase() {
  const name = `echo_test_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  let pool: pg.Pool;
  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: adminUrl() });
    await admin.connect();
    await admin.query(`create database ${name} template ${TEMPLATE_DB}`);
    await admin.end();
    pool = new pg.Pool({ connectionString: dbUrl(name), max: 5 });
    setPool(pool);
  });
  afterAll(async () => {
    await pool.end();
    setPool(undefined);
    const admin = new pg.Client({ connectionString: adminUrl() });
    await admin.connect();
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.end();
  });
  return () => pool;
}

let n = 0;
/** A signed-in person with a verified second factor, plus the given consents. */
export async function makePerson(
  label: string,
  consents: ConsentPurpose[] = ["terms_of_service", "privacy_notice"],
  aal: AuthContext["aal"] = "aal2",
): Promise<AuthContext & { email: string }> {
  n += 1;
  const email = `${label}.${n}.${randomUUID().slice(0, 6)}@example.test`;
  const { accountId } = await provisionAccount({ authSubject: `test|${email}`, email, displayName: label });
  const ctx: AuthContext = { accountId, aal };
  for (const purpose of consents) {
    const docId = await docIdFor(purpose);
    await giveConsent(ctx, { purpose, documentId: docId });
  }
  return { ...ctx, email };
}

export async function docIdFor(purpose: ConsentPurpose): Promise<string> {
  return withSystem(async (db) => (await currentDocuments(db)).get(purpose)!.id);
}

/** Runs raw SQL as the application role on behalf of an account: bypasses all app-level checks. */
export async function rawAs<T = Record<string, unknown>>(
  pool: pg.Pool,
  accountId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role echo_app");
    if (accountId) await c.query("select set_config('app.account_id', $1, true)", [accountId]);
    const r = await c.query(sql, params);
    await c.query("rollback");
    return r.rows as T[];
  } catch (e) {
    await c.query("rollback").catch(() => undefined);
    throw e;
  } finally {
    c.release();
  }
}

export async function rawSystem<T = Record<string, unknown>>(pool: pg.Pool, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await pool.query(sql, params)).rows as T[];
}
