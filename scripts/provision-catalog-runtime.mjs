import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });
const adminUrl = process.env.SUPABASE_ADMIN_DATABASE_URL;
if (!adminUrl) {
  throw new Error("SUPABASE_ADMIN_DATABASE_URL is required in .env.local");
}

const password = randomBytes(32).toString("hex");
const unrestrictedAdminUrl = new URL(adminUrl);
unrestrictedAdminUrl.searchParams.delete("options");
const pool = new pg.Pool({ connectionString: unrestrictedAdminUrl.toString() });
try {
  await pool.query(`alter role catalog_runtime login password '${password}'`);
} finally {
  await pool.end();
}

const runtimeUrl = new URL(adminUrl);
const projectSuffix = runtimeUrl.username.includes(".")
  ? runtimeUrl.username.slice(runtimeUrl.username.indexOf("."))
  : "";
runtimeUrl.username = `catalog_runtime${projectSuffix}`;
runtimeUrl.password = password;
runtimeUrl.searchParams.delete("options");

let env = await readFile(".env.local", "utf8");
function setEnv(name, value) {
  const line = `${name}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  env = pattern.test(env) ? env.replace(pattern, line) : `${env.trimEnd()}\n${line}\n`;
}
setEnv("CATALOG_DATABASE_URL", runtimeUrl.toString());
setEnv("TEST_CATALOG_DATABASE_URL", runtimeUrl.toString());
await writeFile(".env.local", env);
console.log("The Catalog runtime credential was saved to .env.local.");
