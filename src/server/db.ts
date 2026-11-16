import pg from "pg";

/**
 * Database access with two explicit contexts (ADR-005):
 *
 *  - withActor(accountId, fn): every normal request. The transaction switches to role `echo_app`
 *    and sets app.account_id, so Postgres row-level security applies to every statement.
 *  - withSystem(fn): privileged, owner-level access. Used ONLY for provisioning an account from the
 *    identity provider and for reference data. Every call site is listed in docs/adr/ADR-005.
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
    await client.query("select set_config('app.account_id', $1, true)", [accountId]);
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
