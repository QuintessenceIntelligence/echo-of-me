/**
 * TEST_PG_URL points at a Postgres server where the test user may create databases, e.g.
 *   postgresql://postgres@localhost/postgres?host=/tmp&port=5433
 */
export const TEMPLATE_DB = "echo_test_template";

export function adminUrl(): string {
  return process.env.TEST_PG_URL ?? "postgresql://postgres@localhost/postgres?host=/tmp&port=5433";
}

export function dbUrl(database: string): string {
  const u = new URL(adminUrl());
  u.pathname = `/${database}`;
  return u.toString();
}
