import pg from "pg";
import { AccountUnavailableError } from "../domain/errors";

/**
 * Database access with two explicit contexts (ADR-005):
 *
 *  - withActor(accountId, fn): every normal request. The transaction switches to role `echo_app`
 *    and sets app.account_id through app.set_actor (which refuses closed accounts), so Postgres
 *    row-level security applies to every statement.
 *  - withAnonymous(fn): application role with no account (only to call app.provision_account).
 *  - withSystem(fn): owner-level access for migrations and tests only. The hosted app connects as
 *    echo_app_login (NOINHERIT), which cannot do anything without SET ROLE echo_app.
 */
export type Queryable = Pick<pg.PoolClient, "query">;

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new pg.Pool({ connectionString, max: 10 });
  }
  return pool;
}

export function setPool(p: pg.Pool | undefined) {
  pool = p;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withActor<T>(accountId: string, fn: (db: Queryable) => Promise<T>): Promise<T> {
  if (!UUID_RE.test(accountId)) throw new Error("withActor requires an account UUID");
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role echo_app");
    // Refuses closed or unknown accounts (migration 0014), so a stale session can do nothing.
    await client.query("select app.set_actor($1)", [accountId]).catch((err: unknown) => {
      if ((err as { message?: string }).message === "account_unavailable") throw new AccountUnavailableError();
      throw err;
    });
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** As the application role with no account set (RLS shows nothing). Used only to call app.provision_account. */
export async function withAnonymous<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local role echo_app");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Owner-level access. Used ONLY by migrations and tests; the running app never calls it (ADR-005). */
export async function withSystem<T>(fn: (db: Queryable) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
