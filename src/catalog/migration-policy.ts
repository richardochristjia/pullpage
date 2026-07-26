import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const REVIEWED_BASELINE = "20260729000000_create_catalog_invalidation_webhook.sql";
const DESTRUCTIVE_SQL = /\b(drop\s+(?:table|column|constraint|type)|truncate|alter\s+column[^;]*type)\b/i;
const REQUIRED_SAFETY_EVIDENCE = [
  "migration-safety: expand/backfill/contract",
  "migration-safety: finite-lock-and-statement-timeouts",
  "migration-safety: two-person-approval",
  "migration-safety: compatibility-window",
  "migration-safety: recovery-threshold",
];

function sha256(content: string | Buffer) {
  return createHash("sha256").update(content).digest("hex");
}

export function validateMigrationSafety(sql: string, filename: string) {
  if (filename <= REVIEWED_BASELINE || !DESTRUCTIVE_SQL.test(sql)) return { safe: true as const };
  const missing = REQUIRED_SAFETY_EVIDENCE.filter((marker) => !sql.toLowerCase().includes(marker));
  if (missing.length) throw new Error(`Destructive migration requires expand/backfill/contract evidence: ${missing.join(", ")}`);
  return { safe: true as const };
}

export function verifyMigrationHistory(directory: string, manifestPath: string) {
  const files = readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { migrations: Record<string, string> };
  if (Object.keys(manifest.migrations).sort().join("\n") !== files.join("\n")) throw new Error("Migration manifest does not match the complete migration history");
  for (const file of files) {
    const sql = readFileSync(join(directory, file));
    if (manifest.migrations[file] !== sha256(sql)) throw new Error(`Applied migration history was edited: ${basename(file)}`);
    validateMigrationSafety(sql.toString("utf8"), file);
  }
  return { valid: true as const, migrationCount: files.length };
}
