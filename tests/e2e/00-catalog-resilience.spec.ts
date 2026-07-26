import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

const adminDatabaseUrl = process.env.SUPABASE_ADMIN_DATABASE_URL;
const webhookSecret = process.env.CATALOG_REVALIDATE_SECRET;
if (!adminDatabaseUrl) throw new Error("SUPABASE_ADMIN_DATABASE_URL is required for Catalog resilience tests");
if (!webhookSecret) throw new Error("CATALOG_REVALIDATE_SECRET is required for Catalog resilience tests");

test.describe.configure({ mode: "serial" });

const invalidate = (request: import("@playwright/test").APIRequestContext) => request.post("/api/catalog/invalidate", {
  headers: { authorization: `Bearer ${webhookSecret}` },
  data: { type: "UPDATE", schema: "catalog_private", table: "catalog_products" },
});

test("shows a safe branded failure when no valid Catalog generation can be loaded", async ({ browser, request }) => {
  test.setTimeout(60_000);
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const lockClient = await admin.connect();
  await lockClient.query("begin");
  await lockClient.query("lock table catalog_private.catalog_products in access exclusive mode");
  let databaseRestored = false;

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const sitemapPromise = request.get("/sitemap.xml");
    const response = await page.goto("/");

    // Next.js may already have streamed the route shell before the Catalog hole fails.
    expect([200, 500, 503]).toContain(response?.status());
    await expect(page.getByRole("heading", { name: "The Catalog is temporarily unavailable" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry loading the Catalog" })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
    await expect(page.locator("body")).not.toContainText(/postgres|prisma|supabase|catalog_runtime|select\s|password|stack/i);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    const sitemap = await sitemapPromise;
    expect(sitemap.status()).toBeGreaterThanOrEqual(500);
    expect(await sitemap.text()).not.toContain("<urlset");

    let retryRequests = 0;
    page.on("request", (request) => {
      if (request.isNavigationRequest() && new URL(request.url()).pathname === "/") retryRequests += 1;
    });
    await lockClient.query("rollback");
    lockClient.release();
    databaseRestored = true;
    await page.getByRole("button", { name: "Retry loading the Catalog" }).click();
    await expect(page.getByRole("heading", { name: "Catalog Products" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry loading the Catalog" })).toHaveCount(0);
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await page.waitForTimeout(1_000);
    expect(retryRequests).toBeLessThanOrEqual(1);

    await context.close();
  } finally {
    if (!databaseRestored) {
      await lockClient.query("rollback");
      lockClient.release();
    }
    await admin.end();
  }
});

test("keeps one coherent last-known-good generation beyond 60 seconds of database outage", async ({ request }) => {
  test.setTimeout(90_000);
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const seeded = await admin.query<{ slug: string; card_name: string }>(`
    select slug, card_name from catalog_public.active_catalog_products order by slug limit 1
  `);
  const { slug, card_name: cardName } = seeded.rows[0];

  expect((await request.get("/")).status()).toBeLessThan(500);
  expect((await request.get(`/products/${slug}`)).status()).toBeLessThan(500);
  expect((await request.get("/sitemap.xml")).status()).toBe(200);

  const lockClient = await admin.connect();
  await lockClient.query("begin");
  await lockClient.query("lock table catalog_private.catalog_products in access exclusive mode");
  let databaseRestored = false;
  try {
    expect((await invalidate(request)).status()).toBe(200);
    const observations: Array<{ at: string; shelf: number; product: number; sitemap: number }> = [];
    const outageStartedAt = Date.now();
    while (Date.now() - outageStartedAt < 65_000) {
      const [shelf, product, sitemap] = await Promise.all([
        request.get("/"),
        request.get(`/products/${slug}`),
        request.get("/sitemap.xml"),
      ]);
      const shelfBody = await shelf.text();
      const productBody = await product.text();
      const sitemapBody = await sitemap.text();
      observations.push({ at: new Date().toISOString(), shelf: shelf.status(), product: product.status(), sitemap: sitemap.status() });

      expect(shelf.status()).toBeLessThan(500);
      expect(product.status()).toBeLessThan(500);
      expect(sitemap.status()).toBe(200);
      expect(shelfBody).toContain(cardName);
      expect(productBody).toContain(cardName);
      expect(sitemapBody).toContain(`/products/${slug}`);
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
    expect(observations.length).toBeGreaterThanOrEqual(4);

    await lockClient.query("rollback");
    lockClient.release();
    databaseRestored = true;
    expect((await invalidate(request)).status()).toBe(200);
    await expect.poll(async () => (await request.get("/")).status(), { timeout: 60_000 }).toBeLessThan(500);
  } finally {
    if (!databaseRestored) {
      await lockClient.query("rollback");
      lockClient.release();
    }
    await admin.end();
  }
});

test("converges a missed webhook through the 30-second polling policy", async ({ request }) => {
  test.setTimeout(75_000);
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const seeded = await admin.query<{ id: string; card_name: string }>(`
    select id, card_name from catalog_private.catalog_products
    where archived_at is null order by slug limit 1
  `);
  const original = seeded.rows[0];
  const changedName = `Missed Webhook ${Date.now()}`;

  try {
    expect((await request.get("/")).status()).toBeLessThan(500);
    await admin.query("update catalog_private.catalog_products set card_name = $2 where id = $1", [original.id, changedName]);

    const startedAt = Date.now();
    await expect.poll(async () => (await request.get("/")).text(), {
      timeout: 60_000,
      intervals: Array.from({ length: 12 }, () => 5_000),
    }).toContain(changedName);
    expect(Date.now() - startedAt).toBeLessThanOrEqual(60_000);
  } finally {
    await admin.query("update catalog_private.catalog_products set card_name = $2 where id = $1", [original.id, original.card_name]);
    await invalidate(request);
    await admin.end();
  }
});

test("blocks for a fresh generation after idle expiry and withdraws date-expired rights without a webhook", async ({ request }) => {
  test.setTimeout(100_000);
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const previewUrl = "https://res.cloudinary.com/pullpage-resilience/image/upload/v1700000007/catalog-products/resilience/idle-expiry.png";
  const configuration = await admin.query<{
    environment_name: string; cloud_name: string; asset_folder: string; created_at: Date; updated_at: Date;
  }>("select environment_name, cloud_name, asset_folder, created_at, updated_at from catalog_private.product_preview_configuration");
  const product = await admin.query<{ id: string; product_preview_url: string | null; product_preview_rights_id: string | null }>(`
    select id, product_preview_url, product_preview_rights_id
    from catalog_private.catalog_products where archived_at is null order by slug limit 1
  `);
  let rightsId: string | undefined;

  try {
    await admin.query("delete from catalog_private.product_preview_configuration");
    await admin.query(`
      insert into catalog_private.product_preview_configuration (environment_name, cloud_name)
      values ('resilience-test', 'pullpage-resilience')
    `);
    const rights = await admin.query<{ id: string }>(`
      insert into catalog_private.product_preview_rights (
        exact_versioned_url, asset_identifier, source, creator_photographer, owner_licensor,
        permission_basis, permission_evidence, channels, territories, attribution_required,
        effective_on, expires_on, status, reviewer, reviewed_at
      ) values ($1, 'resilience-idle-v1', 'commission', 'Resilience Creator', 'Pullpage',
        'written permission', 'resilience evidence', array['catalog'], array['ID'], false,
        current_date - 2, current_date, 'approved', 'Resilience Reviewer', statement_timestamp())
      returning id
    `, [previewUrl]);
    rightsId = rights.rows[0].id;
    await admin.query(`
      update catalog_private.catalog_products
      set product_preview_url = $2, product_preview_rights_id = $3 where id = $1
    `, [product.rows[0].id, previewUrl, rightsId]);
    await invalidate(request);
    await expect.poll(async () => (await request.get("/sitemap.xml")).text(), { timeout: 60_000 }).toContain(previewUrl);

    await admin.query("update catalog_private.product_preview_rights set expires_on = current_date - 1 where id = $1", [rightsId]);
    await new Promise((resolve) => setTimeout(resolve, 61_000));
    const startedAt = Date.now();
    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).not.toContain(previewUrl);
    expect(Date.now() - startedAt).toBeLessThanOrEqual(12_000);
  } finally {
    await admin.query(`
      update catalog_private.catalog_products
      set product_preview_url = $2, product_preview_rights_id = $3 where id = $1
    `, [product.rows[0].id, product.rows[0].product_preview_url, product.rows[0].product_preview_rights_id]);
    if (rightsId) await admin.query("delete from catalog_private.product_preview_rights where id = $1", [rightsId]);
    await admin.query("delete from catalog_private.product_preview_configuration");
    for (const row of configuration.rows) {
      await admin.query(`
        insert into catalog_private.product_preview_configuration
          (environment_name, cloud_name, asset_folder, created_at, updated_at)
        values ($1, $2, $3, $4, $5)
      `, [row.environment_name, row.cloud_name, row.asset_folder, row.created_at, row.updated_at]);
    }
    await invalidate(request);
    await admin.end();
  }
});
