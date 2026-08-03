import { expect, test } from "@playwright/test";
import { Pool, type PoolClient } from "pg";
import { requireDisposableLocalDatabaseUrl } from "../support/local-database";

const adminDatabaseUrl = requireDisposableLocalDatabaseUrl(
  process.env.LOCAL_MIGRATION_DATABASE_URL,
  "LOCAL_MIGRATION_DATABASE_URL",
);
const productId = "11111111-1111-4111-8111-111111111111";

test("uses 60-second freshness, keeps a cached Catalog during refresh failure, and brands a cold outage", async ({ page, request }) => {
  test.setTimeout(180_000);
  const admin = new Pool({ connectionString: adminDatabaseUrl, max: 2 });
  const original = await admin.query<{ card_name: string }>(
    "select card_name from catalog_private.catalog_products where id = $1",
    [productId],
  );
  expect(original.rows).toHaveLength(1);
  const originalName = original.rows[0].card_name;
  const changedName = `Cache Freshness ${Date.now()}`;
  let lock: PoolClient | undefined;

  const acquireCatalogLock = async () => {
    lock = await admin.connect();
    await lock.query("begin");
    await lock.query("lock table catalog_private.catalog_products in access exclusive mode");
  };
  const releaseCatalogLock = async () => {
    if (!lock) return;
    await lock.query("rollback");
    lock.release();
    lock = undefined;
  };

  try {
    await acquireCatalogLock();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "The Catalog is temporarily unavailable" })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    await releaseCatalogLock();

    await page.goto("/");
    await expect(page.getByText(originalName, { exact: true }).first()).toBeVisible();

    await admin.query("update catalog_private.catalog_products set card_name = $2 where id = $1", [productId, changedName]);
    await expect.poll(async () => {
      const response = await request.get(`/?freshness=${Date.now()}`);
      return response.text();
    }, {
      message: "an ordinary cache refresh should expose the edit within approximately 60 seconds",
      timeout: 80_000,
      intervals: [1_000, 2_000, 5_000],
    }).toContain(changedName);

    await acquireCatalogLock();
    await page.waitForTimeout(61_000);
    const cached = await request.get(`/?outage=${Date.now()}`);
    expect(cached.status()).toBe(200);
    expect(await cached.text()).toContain(changedName);
  } finally {
    await releaseCatalogLock();
    await admin.query("update catalog_private.catalog_products set card_name = $2 where id = $1", [productId, originalName]);
    await admin.end();
  }
});
