import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

/**
 * Applies db/migrations/*.sql then db/seed/*.sql in file-name order, once each.
 * Runs as the database owner (never as echo_app). Each file runs in its own transaction.
 */
export async function migrate(connectionString: string, rootDir = process.cwd()): Promise<string[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query(`create table if not exists schema_migrations (
      name text primary key, applied_at timestamptz not null default now())`);
    for (const dir of ["db/migrations", "db/seed"]) {
      const files = readdirSync(join(rootDir, dir)).filter((f) => f.endsWith(".sql")).sort();
      for (const file of files) {
        const name = `${dir}/${file}`;
        const done = await client.query("select 1 from schema_migrations where name = $1", [name]);
        if (done.rowCount) continue;
        const sql = readFileSync(join(rootDir, dir, file), "utf8");
        await client.query("begin");
        try {
          await client.query(sql);
          await client.query("insert into schema_migrations(name) values ($1)", [name]);
          await client.query("commit");
          applied.push(name);
        } catch (err) {
          await client.query("rollback");
          throw new Error(`Migration ${name} failed: ${(err as Error).message}`);
        }
      }
    }
  } finally {
    await client.end();
  }
  return applied;
}
