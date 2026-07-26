import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const webhookSecret = process.env.CATALOG_REVALIDATE_SECRET;
const previewUrl = "https://res.cloudinary.com/pullpage-archive-tests/image/upload/v1700000006/catalog-products/archive/lifecycle.png";
let admin: Pool;
let productId: string;
let productSlug: string;
let rightsId: string;
let previousConfiguration: {
  environment_name: string;
  cloud_name: string;
  asset_folder: string;
  created_at: Date;
  updated_at: Date;
} | null;

const invalidate = (request: APIRequestContext) => request.post("/api/catalog/invalidate", {
  headers: { authorization: `Bearer ${webhookSecret}` },
  data: { type: "UPDATE", schema: "catalog_private", table: "catalog_products" },
});

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  admin = new Pool({ connectionString: process.env.SUPABASE_ADMIN_DATABASE_URL });
  const previous = await admin.query<NonNullable<typeof previousConfiguration>>(
    "select environment_name, cloud_name, asset_folder, created_at, updated_at from catalog_private.product_preview_configuration",
  );
  previousConfiguration = previous.rows[0] ?? null;
  await admin.query("delete from catalog_private.product_preview_configuration");
  await admin.query(
    "insert into catalog_private.product_preview_configuration (environment_name, cloud_name) values ('archive-browser-test', 'pullpage-archive-tests')",
  );
  const rights = await admin.query<{ id: string }>(`
    insert into catalog_private.product_preview_rights (
      exact_versioned_url, asset_identifier, source, creator_photographer, owner_licensor,
      permission_basis, permission_evidence, channels, territories, attribution_required,
      effective_on, status, reviewer, reviewed_at
    ) values ($1, 'archive-browser-v1', 'commission', 'Archive Creator', 'Pullpage',
      'written permission', 'archive browser evidence', array['catalog', 'social'], array['ID'], false,
      current_date, 'approved', 'Archive Reviewer', statement_timestamp())
    returning id
  `, [previewUrl]);
  rightsId = rights.rows[0].id;
  const product = await admin.query<{ id: string; slug: string }>(`
    insert into catalog_private.catalog_products (
      card_name, collector_number, set_name, rarity_code, design_name, format_code,
      binder_sleeve_price, product_preview_url, product_preview_rights_id
    ) values ('Archive Browser Product', '006/006', 'Archive Workflow Set', 'AR',
      'Restorable Design', 'BS', 96000, $1, $2)
    returning id, slug
  `, [previewUrl, rightsId]);
  productId = product.rows[0].id;
  productSlug = product.rows[0].slug;
  expect((await invalidate(request)).status()).toBe(200);
});

test.afterAll(async ({ request }) => {
  await admin.query("delete from catalog_private.catalog_products where id = $1", [productId]);
  await admin.query("delete from catalog_private.product_preview_rights where id = $1", [rightsId]);
  await admin.query("delete from catalog_private.product_preview_configuration");
  if (previousConfiguration) {
    await admin.query(
      `insert into catalog_private.product_preview_configuration
        (environment_name, cloud_name, asset_folder, created_at, updated_at)
       values ($1, $2, $3, $4, $5)`,
      [previousConfiguration.environment_name, previousConfiguration.cloud_name,
        previousConfiguration.asset_folder, previousConfiguration.created_at, previousConfiguration.updated_at],
    );
  }
  await invalidate(request);
  await admin.end();
});

test("archives and restores one Catalog Product across stale, browser, crawler, metadata, and sitemap outputs", async ({ page, request, browser }) => {
  test.setTimeout(60_000);
  const canonical = `https://pullpage.vercel.app/products/${productSlug}`;
  await page.route("https://res.cloudinary.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  }));

  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
  await search.fill("Archive Browser Product");
  const activeLink = page.getByRole("link", { name: /Archive Browser Product.*006\/006.*Restorable Design/ });
  await expect(activeLink).toBeVisible();
  await expect(activeLink).toHaveAttribute("href", `/products/${productSlug}`);
  const activeSitemap = await (await request.get("/sitemap.xml")).text();
  expect(activeSitemap).toContain(`<loc>${canonical}</loc>`);
  expect(activeSitemap).toContain(`<image:loc>${previewUrl}</image:loc>`);

  await admin.query("update catalog_private.product_preview_rights set status = 'rejected', takedown_notes = 'archive test' where id = $1", [rightsId]);
  const archiveTime = new Date(Date.now() + 86_400_000);
  await admin.query("update catalog_private.catalog_products set archived_at = $2 where id = $1", [productId, archiveTime]);

  await expect.poll(async () => (await (await request.get("/sitemap.xml")).text()).includes(canonical), {
    timeout: 15_000,
    message: "the database webhook should withdraw the archived product",
  }).toBe(false);

  // The delivered shelf remains coherent while navigation resolves against the new generation.
  await expect(activeLink).toBeVisible();
  await activeLink.click();
  await expect(page).toHaveURL(`/products/${productSlug}`);
  const archivedDialog = page.getByRole("dialog", { name: "Catalog Product not found" });
  await expect(archivedDialog).toBeVisible();
  await expect(archivedDialog.getByRole("link", { name: "Return to the Catalog shelf" })).toBeVisible();
  await expect(archivedDialog.getByText("Archive Browser Product")).toHaveCount(0);
  await expect(archivedDialog).not.toContainText(/unavailable|out of stock|sold out/i);
  expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThanOrEqual(1);

  const hardContext = await browser.newContext({
    userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  });
  const hard = await hardContext.newPage();
  const archivedResponse = await hard.goto(`/products/${productSlug}`);
  expect([200, 404]).toContain(archivedResponse?.status());
  await expect(hard.getByRole("heading", { name: "Catalog Product not found" })).toBeVisible();
  await expect(hard.getByText("Archive Browser Product")).toHaveCount(0);
  await expect(hard.getByRole("main")).not.toContainText(/unavailable|out of stock|sold out/i);
  await expect(hard.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(hard.locator('meta[property="og:title"]')).toHaveAttribute("content", "Pullpage");
  await hardContext.close();

  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search Catalog Products" }).fill("Archive Browser Product");
  await expect(page.getByRole("status")).toHaveText("0 results");
  const archivedSitemap = await (await request.get("/sitemap.xml")).text();
  expect(archivedSitemap).not.toContain(canonical);
  expect(archivedSitemap).not.toContain(previewUrl);

  await admin.query("update catalog_private.product_preview_rights set status = 'approved', takedown_notes = null where id = $1", [rightsId]);
  const restored = await admin.query<{ id: string; slug: string }>(
    "update catalog_private.catalog_products set archived_at = null where id = $1 returning id, slug",
    [productId],
  );
  expect(restored.rows[0]).toEqual({ id: productId, slug: productSlug });
  expect((await invalidate(request)).status()).toBe(200);

  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search Catalog Products" }).fill("Archive Browser Product");
  const restoredLink = page.getByRole("link", { name: /Archive Browser Product.*006\/006.*Restorable Design/ });
  await expect(restoredLink).toHaveAttribute("href", `/products/${productSlug}`);
  await restoredLink.click();
  await expect(page.getByRole("dialog", { name: "Archive Browser Product — Restorable Design" })).toBeVisible();
  await page.goto(`/products/${productSlug}`);
  await expect(page).toHaveTitle("Archive Browser Product — Restorable Design | Pullpage");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
  await expect(page.getByRole("heading", { level: 1, name: "Archive Browser Product — Restorable Design" })).toBeVisible();
  const restoredSitemap = await (await request.get("/sitemap.xml")).text();
  expect(restoredSitemap).toContain(`<loc>${canonical}</loc>`);
  expect(restoredSitemap).toContain(`<image:loc>${previewUrl}</image:loc>`);
});
