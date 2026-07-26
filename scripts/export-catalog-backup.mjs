import { spawn } from "node:child_process";
import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { readCatalogBackupInventory } from "./catalog-backup-inventory.mjs";

dotenv.config({ path: ".env.local", quiet: true });
const databaseUrl = process.env.SUPABASE_ADMIN_DATABASE_URL;
const recipient = process.env.CATALOG_BACKUP_AGE_RECIPIENT;
const destination = process.env.CATALOG_BACKUP_DESTINATION;
if (!databaseUrl || !recipient || !destination) {
  throw new Error("SUPABASE_ADMIN_DATABASE_URL, CATALOG_BACKUP_AGE_RECIPIENT, and CATALOG_BACKUP_DESTINATION are required.");
}
if (!destination.endsWith(".age")) throw new Error("CATALOG_BACKUP_DESTINATION must end in .age.");

function postgresEnvironment(value) {
  const url = new URL(value);
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1) || "postgres",
    PGSSLMODE: url.searchParams.get("sslmode") ?? "require",
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: options.stdio ?? "inherit", env: options.env ?? process.env });
    child.on("error", () => reject(new Error(`${command} is required for encrypted Catalog exports.`)));
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} failed with exit code ${code}.`)));
  });
}

const previousUmask = process.umask(0o077);
const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "pullpage-catalog-backup-"))
  .catch((error) => {
    process.umask(previousUmask);
    throw error;
  });
const dumpPath = path.join(temporaryDirectory, "catalog.dump");
const rolesPath = path.join(temporaryDirectory, "roles.sql");
const manifestPath = path.join(temporaryDirectory, "manifest.json");
const pgEnvironment = postgresEnvironment(databaseUrl);
try {
  const inventory = await readCatalogBackupInventory(databaseUrl);
  await run("pg_dump", ["--format=custom", "--file", dumpPath, "--schema", "catalog_private", "--schema", "catalog_public"], { env: pgEnvironment });
  await writeFile(rolesPath, `do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'catalog_runtime') then create role catalog_runtime nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'catalog_editor') then create role catalog_editor nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'catalog_recovery_operator') then create role catalog_recovery_operator nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'catalog_audit_owner') then create role catalog_audit_owner nologin noinherit; end if;
end $$;
`, { mode: 0o600 });
  await run("pg_restore", ["--list", dumpPath], { stdio: "ignore" });
  await writeFile(manifestPath, JSON.stringify({ exportedAt: new Date().toISOString(), ...inventory }, null, 2), { mode: 0o600 });
  await Promise.all([dumpPath, rolesPath, manifestPath].map((file) => chmod(file, 0o600)));

  await new Promise((resolve, reject) => {
    const archive = spawn("tar", ["-cf", "-", "-C", temporaryDirectory, "."], { stdio: ["ignore", "pipe", "inherit"] });
    const encryption = spawn("age", ["--recipient", recipient, "--output", destination], { stdio: ["pipe", "inherit", "inherit"] });
    archive.stdout.pipe(encryption.stdin);
    let archiveCode;
    let encryptionCode;
    const finish = () => {
      if (archiveCode === undefined || encryptionCode === undefined) return;
      if (archiveCode === 0 && encryptionCode === 0) resolve();
      else reject(new Error("Encrypted Catalog archive creation failed."));
    };
    archive.on("error", () => reject(new Error("tar is required for encrypted Catalog exports.")));
    encryption.on("error", () => reject(new Error("age is required for encrypted Catalog exports.")));
    archive.on("exit", (code) => { archiveCode = code; finish(); });
    encryption.on("exit", (code) => { encryptionCode = code; finish(); });
  });

  const output = await stat(destination);
  if (output.size === 0) throw new Error("The encrypted Catalog export is empty.");
  console.info(JSON.stringify({ exportedAt: new Date().toISOString(), destination, encryptedBytes: output.size, counts: inventory.counts }));
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
  process.umask(previousUmask);
}
