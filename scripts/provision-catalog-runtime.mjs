import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.migration.local", quiet: true });
const migrationUrl = process.env.LOCAL_MIGRATION_DATABASE_URL ?? process.env.CATALOG_MIGRATION_DATABASE_URL;
if (!migrationUrl) throw new Error("CATALOG_MIGRATION_DATABASE_URL is required in .env.migration.local (or use LOCAL_MIGRATION_DATABASE_URL for disposable local Supabase)");

const ownerUrl = new URL(migrationUrl);
if (ownerUrl.protocol !== "postgresql:" || ownerUrl.username.startsWith("catalog_runtime") || ownerUrl.port === "6543") {
  throw new Error("Runtime provisioning requires a PostgreSQL owner URL using direct or session connectivity");
}

const password = randomBytes(32).toString("hex");
const pool = new pg.Pool({ connectionString: ownerUrl.toString(), max: 1, connectionTimeoutMillis: 10_000 });
try {
  await pool.query(`alter role catalog_runtime login password '${password}'`);
} finally {
  await pool.end();
}

const runtimeUrl = new URL(ownerUrl);
const projectSuffix = runtimeUrl.username.includes(".")
  ? runtimeUrl.username.slice(runtimeUrl.username.indexOf("."))
  : "";
runtimeUrl.username = `catalog_runtime${projectSuffix}`;
runtimeUrl.password = password;
runtimeUrl.searchParams.delete("options");

let env = "";
function setEnv(name, value) {
  const line = `${name}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}${env.trim() ? "\n" : ""}${line}\n`;
}
setEnv("CATALOG_DATABASE_URL", runtimeUrl.toString());
setEnv("TEST_CATALOG_DATABASE_URL", runtimeUrl.toString());
await writeFile(".env.local", env);
console.log("The read-only Catalog runtime credential was saved to .env.local.");
