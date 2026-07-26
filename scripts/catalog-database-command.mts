import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import dotenv from "dotenv";
import pg from "pg";
import { assertCatalogDatabaseOperation } from "../src/catalog/environment-policy.ts";
import { verifyMigrationHistory } from "../src/catalog/migration-policy.ts";

dotenv.config({ path: ".env.promotion.local", quiet: true });
dotenv.config({ path: ".env.local", quiet: true });
const [operation, environment] = process.argv.slice(2) as ["reset" | "migration", "local" | "preview" | "production"];
assertCatalogDatabaseOperation({ operation, environment });

function run(command: string, args: string[], env = process.env) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited unsuccessfully`)));
  });
}

const runSupabase = (args: string[]) => run(process.execPath, ["node_modules/supabase/dist/supabase.js", ...args]);

if (operation === "reset") {
  await runSupabase(["db", "reset"]);
  await run(process.execPath, ["scripts/seed-synthetic-catalog.mts"], {
    ...process.env,
    CATALOG_SEED_ENVIRONMENT: "local",
    CATALOG_ALLOW_SYNTHETIC_SEED: "true",
  });
} else {
  verifyMigrationHistory(join(process.cwd(), "supabase/migrations"), join(process.cwd(), "supabase/migration-manifest.json"));
  const prefix = environment === "preview" ? "PREVIEW" : "PRODUCTION";
  const databaseUrl = process.env[`${prefix}_MIGRATION_DATABASE_URL`];
  if (!databaseUrl) throw new Error(`${environment} migration identity is incomplete`);
  const url = new URL(databaseUrl);
  if (url.protocol !== "postgresql:" || !url.searchParams.has("sslmode") || url.port === "6543") throw new Error("Migration access must use TLS direct/session connectivity, never the transaction pool");
  const expectedCommit = process.env.CATALOG_RELEASE_COMMIT;
  const actualCommit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (expectedCommit && expectedCommit !== actualCommit) throw new Error("Migration and application commits do not match");
  if (environment === "production") {
    const approvers = JSON.parse(process.env.CATALOG_RELEASE_APPROVERS ?? "[]") as unknown[];
    if (process.env.CATALOG_RELEASE_EDIT_FREEZE !== "true" || new Set(approvers).size < 2 || !process.env.CATALOG_RELEASE_EXPORT_REFERENCE) {
      throw new Error("Production migration requires edit freeze, two approvers, and a verified export reference");
    }
  }
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
  const client = await pool.connect();
  try {
    const lock = await client.query<{ acquired: boolean }>("select pg_try_advisory_lock(hashtext('pullpage_catalog_migration')) acquired");
    if (!lock.rows[0].acquired) throw new Error(`Another ${environment} Catalog migration is already running`);
    await runSupabase(["db", "push", "--db-url", databaseUrl]);
  } finally {
    await client.query("select pg_advisory_unlock(hashtext('pullpage_catalog_migration'))").catch(() => undefined);
    client.release();
    await pool.end();
  }
  console.log(JSON.stringify({ environment, commit: actualCommit, migrationsVerified: true, seeded: false }));
}
