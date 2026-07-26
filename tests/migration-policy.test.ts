import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyMigrationHistory, validateMigrationSafety } from "@/catalog/migration-policy";

describe("Catalog migration policy", () => {
  test("protects the reviewed immutable migration history", () => {
    expect(verifyMigrationHistory(join(process.cwd(), "supabase/migrations"), join(process.cwd(), "supabase/migration-manifest.json"))).toMatchObject({ valid: true, migrationCount: 17 });
  });

  test("requires expand/backfill/contract evidence for new destructive SQL", () => {
    expect(() => validateMigrationSafety("drop table catalog_private.catalog_products;", "20260730000000_bad.sql")).toThrow(/expand\/backfill\/contract/i);
    const reviewed = readFileSync(join(process.cwd(), "supabase/migrations/20260729000000_create_catalog_invalidation_webhook.sql"), "utf8");
    expect(validateMigrationSafety(reviewed, "20260729000000_create_catalog_invalidation_webhook.sql")).toEqual({ safe: true });
  });
});
