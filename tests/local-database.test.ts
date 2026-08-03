import { describe, expect, test } from "vitest";
import { requireDisposableLocalDatabaseUrl } from "./support/local-database";

describe("disposable local database guard", () => {
  test.each([
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "postgresql://postgres:postgres@localhost:54322/postgres",
    "postgresql://postgres:postgres@[::1]:54322/postgres",
  ])("accepts a loopback PostgreSQL database", (databaseUrl) => {
    expect(requireDisposableLocalDatabaseUrl(databaseUrl, "LOCAL_MIGRATION_DATABASE_URL")).toBe(databaseUrl);
  });

  test.each([
    "postgresql://postgres:secret@db.example.supabase.co:5432/postgres",
    "postgresql://postgres:secret@192.168.1.20:5432/postgres",
    "https://127.0.0.1:54322/postgres",
    "not-a-url",
    "",
  ])("rejects a database that could be hosted or malformed", (databaseUrl) => {
    expect(() => requireDisposableLocalDatabaseUrl(databaseUrl, "LOCAL_MIGRATION_DATABASE_URL"))
      .toThrow(/disposable loopback PostgreSQL database/i);
  });
});
