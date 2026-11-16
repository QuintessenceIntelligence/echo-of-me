import pg from "pg";
import { migrate } from "../src/server/migrate";
import { adminUrl, dbUrl, TEMPLATE_DB } from "./db-urls";

/** Builds a migrated template database once; each test file clones it (see tests/helpers.ts). */
export default async function setup() {
  const admin = new pg.Client({ connectionString: adminUrl() });
  await admin.connect();
  await admin.query(`drop database if exists ${TEMPLATE_DB} with (force)`);
  await admin.query(`create database ${TEMPLATE_DB}`);
  await admin.end();
  await migrate(dbUrl(TEMPLATE_DB));
}
