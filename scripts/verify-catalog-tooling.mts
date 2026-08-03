import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { verifyMigrationHistory } from "../src/catalog/migration-policy.ts";

const root = process.cwd();
verifyMigrationHistory(join(root, "supabase/migrations"), join(root, "supabase/migration-manifest.json"));
const workflows = readdirSync(join(root, ".github/workflows")).map((file) => join(root, ".github/workflows", file));
const reviewedFiles = [join(root, "package.json"), ...workflows];
const prohibited = /prisma\s+(?:db\s+push|migrate\s+dev|studio)|supabase\s+db\s+(?:reset|push)[^\n]*(?:--linked|include-seed)/i;
for (const file of reviewedFiles) {
  if (prohibited.test(readFileSync(file, "utf8"))) throw new Error(`Prohibited hosted database workflow in ${relative(root, file)}`);
}

const retiredFiles = [
  "config/catalog-environments.json",
  "docs/catalog-promotion-runbook.md",
  "docs/catalog-recovery-runbook.md",
  "docs/catalog-resilience-runbook.md",
  "scripts/catalog-backup-inventory.mjs",
  "scripts/catalog-database-command.mts",
  "scripts/change-catalog-product.mjs",
  "scripts/export-catalog-backup.mjs",
  "scripts/export-catalog-release-snapshot.mts",
  "scripts/qualify-catalog-resilience.mjs",
  "src/catalog/environment-policy.ts",
];
const retainedRetiredFile = retiredFiles.find((file) => existsSync(join(root, file)));
if (retainedRetiredFile) throw new Error(`Retired Catalog operation still exists: ${retainedRetiredFile}`);

const currentDocumentation = [join(root, "README.md"), join(root, "docs/catalog-editor-guide.md")];
const retiredWorkflowLanguage = /\b(?:draft|publish|rights|archive|restore|webhook|promotion|audit|recovery)\b/i;
for (const file of currentDocumentation) {
  if (retiredWorkflowLanguage.test(readFileSync(file, "utf8"))) throw new Error(`Retired Catalog workflow described by ${relative(root, file)}`);
}

const currentOperationalFiles = [
  ...currentDocumentation,
  join(root, "package.json"),
  join(root, "supabase/seed.sql"),
  ...workflows,
];
const retiredReference = /CATALOG_REVALIDATE_SECRET|SUPABASE_ADMIN_DATABASE_URL|(?:PREVIEW|PRODUCTION)_MIGRATION_DATABASE_URL|db:(?:recover-product|hard-delete-product|export-catalog|export-release-snapshot|migrate:preview|migrate:production)|catalog-(?:promotion|recovery|resilience)-runbook/i;
for (const file of currentOperationalFiles) {
  if (retiredReference.test(readFileSync(file, "utf8"))) throw new Error(`Retired Catalog operation referenced by ${relative(root, file)}`);
}

function treeHash(directory: string) {
  const hash = createHash("sha256");
  const visit = (current: string) => {
    for (const name of readdirSync(current).sort()) {
      const path = join(current, name);
      if (statSync(path).isDirectory()) visit(path);
      else hash.update(relative(directory, path)).update(readFileSync(path));
    }
  };
  visit(directory);
  return hash.digest("hex");
}
const generatePrisma = () => process.platform === "win32"
  ? execFileSync(process.env.ComSpec!, ["/d", "/c", "npx prisma generate"], { stdio: "ignore" })
  : execFileSync("npx", ["prisma", "generate"], { stdio: "ignore" });
generatePrisma();
const first = treeHash(join(root, "src/generated/prisma"));
generatePrisma();
const second = treeHash(join(root, "src/generated/prisma"));
if (first !== second) throw new Error("Prisma generation is not deterministic");
console.log(JSON.stringify({
  migrationsImmutable: true,
  prohibitedWorkflowsAbsent: true,
  retiredOperationsAbsent: true,
  prismaGenerationDeterministic: true,
}));
