import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { verifyMigrationHistory } from "../src/catalog/migration-policy.ts";

const root = process.cwd();
verifyMigrationHistory(join(root, "supabase/migrations"), join(root, "supabase/migration-manifest.json"));
const reviewedFiles = [join(root, "package.json"), ...readdirSync(join(root, ".github/workflows")).map((file) => join(root, ".github/workflows", file))];
const prohibited = /prisma\s+(?:db\s+push|migrate\s+dev|studio)|supabase\s+db\s+(?:reset|push)[^\n]*(?:--linked|include-seed)/i;
for (const file of reviewedFiles) {
  if (prohibited.test(readFileSync(file, "utf8"))) throw new Error(`Prohibited hosted database workflow in ${relative(root, file)}`);
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
console.log(JSON.stringify({ migrationsImmutable: true, prohibitedWorkflowsAbsent: true, prismaGenerationDeterministic: true }));
