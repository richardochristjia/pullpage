import { describe, expect, test } from "vitest";
import { assertCatalogDatabaseOperation, assertSyntheticSeedTarget, validateCatalogCredential, validateCatalogEnvironments, type CatalogEnvironmentInventory } from "@/catalog/environment-policy";
import committedInventory from "../config/catalog-environments.json";

const inventory = (): CatalogEnvironmentInventory => ({
  runtimeRegion: "sin1",
  environments: {
    local: { projectRef: "local", supabaseRegion: "local", vercelScope: "local", runtimeCredential: "LOCAL_CATALOG_DATABASE_URL", migrationCredential: "LOCAL_MIGRATION_DATABASE_URL", webhookSecret: "LOCAL_CATALOG_REVALIDATE_SECRET", cloudinaryConfiguration: "local-synthetic", backupTarget: "local-disposable", seedAllowed: true },
    preview: { projectRef: "preview-ref", supabaseRegion: "ap-southeast-1", vercelScope: "pullpage-preview", runtimeCredential: "PREVIEW_CATALOG_DATABASE_URL", migrationCredential: "PREVIEW_MIGRATION_DATABASE_URL", webhookSecret: "PREVIEW_CATALOG_REVALIDATE_SECRET", cloudinaryConfiguration: "preview-synthetic", backupTarget: "preview-external-encrypted", seedAllowed: true },
    production: { projectRef: "production-ref", supabaseRegion: "ap-southeast-1", vercelScope: "pullpage-production", runtimeCredential: "PRODUCTION_CATALOG_DATABASE_URL", migrationCredential: "PRODUCTION_MIGRATION_DATABASE_URL", webhookSecret: "PRODUCTION_CATALOG_REVALIDATE_SECRET", cloudinaryConfiguration: "production-reviewed", backupTarget: "production-external-encrypted", seedAllowed: false },
  },
});

describe("Catalog environment policy", () => {
  test("accepts three isolated environments in the Singapore promotion path", () => {
    expect(validateCatalogEnvironments(inventory())).toEqual({ valid: true });
    expect(validateCatalogEnvironments(committedInventory as CatalogEnvironmentInventory)).toEqual({ valid: true });
  });

  test("rejects reused hosted identities, secrets, or Production seeding", () => {
    const candidate = inventory();
    candidate.environments.production.projectRef = candidate.environments.preview.projectRef;
    candidate.environments.production.webhookSecret = candidate.environments.preview.webhookSecret;
    candidate.environments.production.seedAllowed = true;
    expect(() => validateCatalogEnvironments(candidate)).toThrow(/project references.*webhook.*Production seeding/i);
  });

  test("requires hosted credentials to use TLS, finite bounds, and the correct identity", () => {
    expect(validateCatalogCredential("postgresql://catalog_runtime:secret@pool.invalid:6543/postgres?sslmode=require&connect_timeout=10&statement_timeout=10000", "runtime")).toEqual({ valid: true });
    expect(() => validateCatalogCredential("postgresql://postgres:secret@pool.invalid:5432/postgres", "runtime")).toThrow(/TLS.*connect_timeout.*statement_timeout.*catalog_runtime/i);
    expect(() => validateCatalogCredential("postgresql://catalog_runtime:secret@pool.invalid:6543/postgres?sslmode=require&connect_timeout=10&statement_timeout=10000", "migration")).toThrow(/migration identity/i);
  });

  test("refuses synthetic fixtures when a Preview label points at known Production", () => {
    expect(assertSyntheticSeedTarget({
      environment: "preview",
      databaseUrl: "postgresql://postgres.preview-ref:secret@pool.invalid:5432/postgres",
      inventory: inventory(),
    })).toEqual({ allowed: true });
    expect(() => assertSyntheticSeedTarget({
      environment: "preview",
      databaseUrl: "postgresql://postgres.production-ref:secret@pool.invalid:5432/postgres",
      inventory: inventory(),
    })).toThrow(/known Production/i);
  });

  test("permits destructive development commands only against local Supabase", () => {
    expect(assertCatalogDatabaseOperation({ operation: "reset", environment: "local" })).toEqual({ allowed: true });
    expect(() => assertCatalogDatabaseOperation({ operation: "reset", environment: "preview" })).toThrow(/local only/i);
    expect(() => assertCatalogDatabaseOperation({ operation: "studio", environment: "production" })).toThrow(/local only/i);
    expect(() => assertCatalogDatabaseOperation({ operation: "seed", environment: "production" })).toThrow(/never seeded/i);
  });
});
