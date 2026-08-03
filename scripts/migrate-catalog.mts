import { spawn } from "node:child_process";
import { join } from "node:path";
import dotenv from "dotenv";
import { verifyMigrationHistory } from "../src/catalog/migration-policy.ts";

dotenv.config({ path: ".env.migration.local", quiet: true });
const databaseUrl = process.env.CATALOG_MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error("CATALOG_MIGRATION_DATABASE_URL is required in .env.migration.local");

const url = new URL(databaseUrl);
if (url.protocol !== "postgresql:" || url.username.startsWith("catalog_runtime") || url.port === "6543") {
  throw new Error("Catalog migrations require a PostgreSQL owner URL using direct or session connectivity");
}
if (!url.searchParams.has("sslmode")) throw new Error("Catalog migration access must require TLS with sslmode");

verifyMigrationHistory(join(process.cwd(), "supabase/migrations"), join(process.cwd(), "supabase/migration-manifest.json"));

await new Promise<void>((resolve, reject) => {
  const child = spawn(process.execPath, [
    "node_modules/supabase/dist/supabase.js",
    "db",
    "push",
    "--db-url",
    databaseUrl,
  ], { stdio: "inherit" });
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Supabase migration failed")));
});
