import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

const fixtureDesign = "Synthetic Browser Fixture";
const fixtureCollectorPrefix = "synthetic-browser";
const webhookSecret = process.env.CATALOG_REVALIDATE_SECRET;
let admin: Pool;
let archivedSlug: string;
let previewRightsId: string;
let previousSeedPreview: { product_preview_url: string | null; product_preview_rights_id: string | null };
let previousPreviewConfiguration: {
  environment_name: string;
  cloud_name: string;
  asset_folder: string;
  created_at: Date;
  updated_at: Date;
} | null;
const previewUrl = "https://res.cloudinary.com/pullpage-tests/image/upload/v1700000001/catalog-products/pikachu/electric-bloom.png";

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  admin = new Pool({ connectionString: process.env.SUPABASE_ADMIN_DATABASE_URL });
  await admin.query("update catalog_private.catalog_products set archived_at = null where id::text like '10000000-0000-4000-8000-%' and right(id::text, 12)::bigint between 477 and 496");
  const seedPreview = await admin.query<typeof previousSeedPreview>(
    `select product_preview_url, product_preview_rights_id::text
     from catalog_private.catalog_products
     where id = '11111111-1111-4111-8111-111111111111'`,
  );
  previousSeedPreview = seedPreview.rows[0];
  const previous = await admin.query<NonNullable<typeof previousPreviewConfiguration>>(
    "select environment_name, cloud_name, asset_folder, created_at, updated_at from catalog_private.product_preview_configuration",
  );
  previousPreviewConfiguration = previous.rows[0] ?? null;
  await admin.query("delete from catalog_private.product_preview_configuration");
  await admin.query(
    "insert into catalog_private.product_preview_configuration (environment_name, cloud_name) values ('browser-test', 'pullpage-tests')",
  );
  const rights = await admin.query<{ id: string }>(`
    insert into catalog_private.product_preview_rights (
      exact_versioned_url, asset_identifier, source, creator_photographer, owner_licensor,
      permission_basis, permission_evidence, channels, territories, attribution_required,
      effective_on, status, reviewer, reviewed_at
    ) values (
      '${previewUrl}', 'browser-preview-v1', 'commission', 'Preview Creator', 'Pullpage',
      'written permission', 'browser evidence', array['catalog'], array['ID'], false,
      current_date, 'approved', 'Browser Reviewer', statement_timestamp()
    ) returning id
  `);
  previewRightsId = rights.rows[0].id;
  await admin.query(
    `update catalog_private.catalog_products
     set product_preview_url = $1, product_preview_rights_id = $2
     where id = '11111111-1111-4111-8111-111111111111'`,
    [previewUrl, previewRightsId],
  );
  const archived = await admin.query<{ slug: string }>(
    `select slug from catalog_private.catalog_products
     where collector_number = $1 and design_name = $2 and archived_at is not null`,
    [`${fixtureCollectorPrefix}-archived`, fixtureDesign],
  );
  archivedSlug = archived.rows[0].slug;
  const invalidated = await request.post("/api/catalog/invalidate", {
    headers: { authorization: `Bearer ${webhookSecret}` },
    data: { type: "INSERT", schema: "catalog_private", table: "catalog_products" },
  });
  expect(invalidated.status()).toBe(200);
});

test.afterAll(async ({ request }) => {
  await admin.query(
    `update catalog_private.catalog_products
     set product_preview_url = null, product_preview_rights_id = null
     where id = '11111111-1111-4111-8111-111111111111'`,
  );
  await admin.query("delete from catalog_private.product_preview_rights where id = $1", [previewRightsId]);
  await admin.query("delete from catalog_private.product_preview_configuration");
  if (previousPreviewConfiguration) {
    await admin.query(
      `insert into catalog_private.product_preview_configuration
        (environment_name, cloud_name, asset_folder, created_at, updated_at)
       values ($1, $2, $3, $4, $5)`,
      [
        previousPreviewConfiguration.environment_name,
        previousPreviewConfiguration.cloud_name,
        previousPreviewConfiguration.asset_folder,
        previousPreviewConfiguration.created_at,
        previousPreviewConfiguration.updated_at,
      ],
    );
  }
  await admin.query(
    `update catalog_private.catalog_products
     set product_preview_url = $1, product_preview_rights_id = $2
     where id = '11111111-1111-4111-8111-111111111111'`,
    [previousSeedPreview.product_preview_url, previousSeedPreview.product_preview_rights_id],
  );
  await admin.query("update catalog_private.catalog_products set archived_at = timestamptz '2026-01-01 00:00:00+00' where id::text like '10000000-0000-4000-8000-%' and right(id::text, 12)::bigint between 477 and 496");
  await request.post("/api/catalog/invalidate", {
    headers: { authorization: `Bearer ${webhookSecret}` },
    data: { type: "DELETE", schema: "catalog_private", table: "catalog_products" },
  });
  await admin.end();
});

test("searches the delivered Catalog locally and resets a zero-result shelf", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (request.resourceType() !== "image" && !url.startsWith("https://vercel.live/") && url !== page.url()) requests.push(url);
  });

  await search.fill("pika-chu");
  await expect(page.getByRole("status")).toHaveText("1 result");
  await expect(search).toBeFocused();
  expect(new URL(page.url()).search).toBe("");

  await search.fill("does-not-exist");
  await expect(page.getByRole("heading", { name: "No Catalog Products match" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset filters" }).last()).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search Catalog Products" })).toBeVisible();

  await page.getByRole("button", { name: "Reset filters" }).last().click();
  await expect(page.getByRole("status")).toHaveText("500 results");
  expect(requests).toEqual([]);
});

test("loads responsive Product Preview variants only at the shelf and activated detail sizes", async ({ page }) => {
  const imageRequests: string[] = [];
  await page.route("https://res.cloudinary.com/**", async (route) => {
    imageRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
  });

  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
  await search.fill("pikachu");
  const product = page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ });
  const thumbnail = product.locator("img");
  await expect(thumbnail).toBeVisible();
  await expect(thumbnail).toHaveAttribute("alt", "");
  await expect(thumbnail).toHaveAttribute("loading", "lazy");
  await expect(thumbnail).toHaveAttribute("sizes", "(max-width: 440px) 92px, (max-width: 900px) 116px, 138px");
  expect(imageRequests.some((url) => url.includes("c_limit") && url.includes("f_auto") && url.includes("q_auto"))).toBe(true);
  expect(imageRequests.some((url) => /w_(?:640|750|828|960)/.test(url))).toBe(false);

  await product.click();
  const detailImage = page.getByRole("dialog").getByRole("img", { name: "Finished Product Preview for Pikachu — Electric Bloom" });
  await expect(detailImage).toBeVisible();
  await expect(detailImage).toHaveAttribute("sizes", "(max-width: 700px) calc(100vw - 32px), 420px");
  await expect.poll(() => imageRequests.some((url) => /w_(?:640|750|828|960)/.test(url))).toBe(true);
  expect(imageRequests.every((url) => url.includes("/image/upload/f_auto,q_auto,c_limit,w_"))).toBe(true);
});

test("uses the common accessible placeholder without retries for blocked, broken, HTTP, and timeout delivery", async ({ page }) => {
  test.setTimeout(30_000);
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const assertFallback = async (deliver: Parameters<typeof page.route>[1]) => {
    let attempts = 0;
    await page.unroute("https://res.cloudinary.com/**");
    await page.route("https://res.cloudinary.com/**", async (route, request) => {
      attempts += 1;
      await deliver(route, request);
    });
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search Catalog Products" }).fill("pikachu");
    const product = page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ });
    await expect(product.getByLabel("Product Preview unavailable")).toBeVisible({ timeout: 12_000 });
    await expect(product).toContainText("Scarlet & Violet—151");
    await expect(product.locator("img")).toHaveCount(0);
    const attemptsAfterFailure = attempts;
    await page.waitForTimeout(250);
    expect(attemptsAfterFailure).toBe(1);
    expect(attempts).toBe(attemptsAfterFailure);
  };

  await assertFallback((route) => route.abort("blockedbyclient"));
  await assertFallback((route) => route.fulfill({ status: 200, contentType: "image/png", body: "not an image" }));
  await assertFallback((route) => route.fulfill({ status: 503, contentType: "text/plain", body: "unavailable" }));
  await assertFallback(async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 11_000));
    await route.fulfill({ status: 200, contentType: "image/png", body: "too late" });
  });

  expect(consoleErrors.filter((message) => !message.startsWith("Failed to load resource:") && !message.startsWith("net::ERR_BLOCKED_BY_CLIENT"))).toEqual([]);
});

test("withdraws and restores a Product Preview after rights or configuration invalidation", async ({ page, request }) => {
  const invalidate = (table: string) => request.post("/api/catalog/invalidate", {
    headers: { authorization: `Bearer ${webhookSecret}` },
    data: { type: "UPDATE", schema: "catalog_private", table },
  });
  await page.route("https://res.cloudinary.com/**", (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  }));
  const openPikachu = async () => {
    await page.goto("/");
    await page.getByRole("searchbox", { name: "Search Catalog Products" }).fill("pikachu");
    return page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ });
  };

  await expect((await openPikachu()).locator("img")).toBeVisible();
  await admin.query("update catalog_private.product_preview_rights set status = 'rejected', takedown_notes = 'browser withdrawal' where id = $1", [previewRightsId]);
  expect((await invalidate("product_preview_rights")).status()).toBe(200);
  await expect((await openPikachu()).getByLabel("Product Preview unavailable")).toBeVisible();

  await admin.query("update catalog_private.product_preview_rights set status = 'approved' where id = $1", [previewRightsId]);
  await admin.query("update catalog_private.product_preview_configuration set cloud_name = 'other-cloud'");
  expect((await invalidate("product_preview_configuration")).status()).toBe(200);
  await expect((await openPikachu()).getByLabel("Product Preview unavailable")).toBeVisible();

  await admin.query("update catalog_private.product_preview_configuration set cloud_name = 'pullpage-tests'");
  expect((await invalidate("product_preview_configuration")).status()).toBe(200);
  await expect((await openPikachu()).locator("img")).toBeVisible();
});

test("opens a canonical product in a modal and restores shelf state through Back and Forward", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
  await search.fill("pikachu");
  const productLink = page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ });
  await productLink.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 180));
  const shelfScroll = await page.evaluate(() => window.scrollY);
  await productLink.focus();
  await productLink.click();

  await expect(page).toHaveURL(/\/products\/pikachu-/);
  const dialog = page.getByRole("dialog", { name: "Pikachu — Electric Bloom" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Scarlet & Violet—151");
  await expect(dialog).toContainText("Binder Sleeve");
  const close = page.getByRole("button", { name: "Close product details" });
  await expect(close).toBeFocused();
  await expect(page.locator("#app-content")).toHaveAttribute("inert", "");
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("link", { name: "Back to the Catalog shelf" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(search).toHaveValue("pikachu");
  await expect(productLink).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(shelfScroll);

  await page.goForward();
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL("/");
  await expect(productLink).toBeFocused();
});

test("renders complete canonical and branded not-found routes without JavaScript", async ({ browser, page }) => {
  await page.goto("/");
  const href = await page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ }).getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page.getByRole("heading", { level: 1, name: "Pikachu — Electric Bloom" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Pikachu — Electric Bloom" })).toBeVisible();
  const newTab = await page.context().newPage();
  await newTab.goto(href!);
  await expect(newTab.getByRole("heading", { level: 1, name: "Pikachu — Electric Bloom" })).toBeVisible();
  await newTab.close();

  const noScript = await browser.newContext({
    javaScriptEnabled: false,
    userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  });
  const crawlerUrl = new URL(href!, process.env.CATALOG_TEST_ORIGIN ?? "http://127.0.0.1:3000");
  crawlerUrl.searchParams.set("crawler", String(Date.now()));
  if (process.env.CATALOG_TEST_ORIGIN) {
    const crawlerResponse = await noScript.request.get(crawlerUrl.toString());
    const crawlerHtml = await crawlerResponse.text();
    expect(crawlerResponse.status()).toBe(200);
    expect(crawlerHtml).toContain('<h1 id="product-heading">Pikachu — Electric Bloom</h1>');
    expect(crawlerHtml).toContain("Scarlet &amp; Violet—151");
    expect(crawlerHtml).not.toContain('role="dialog"');
  } else {
    const direct = await noScript.newPage();
    await direct.goto(crawlerUrl.toString());
    await expect(direct.getByRole("heading", { level: 1, name: "Pikachu — Electric Bloom" })).toBeVisible();
    await expect(direct.getByText("Scarlet & Violet—151")).toBeVisible();
    await expect(direct.getByRole("img", { name: "Finished Product Preview for Pikachu — Electric Bloom" })).toBeVisible();
    await expect(direct.getByRole("dialog")).toHaveCount(0);
  }

  await noScript.close();

  const missing = await page.goto("/products/not-a-catalog-product-deadbeef");
  expect([200, 404]).toContain(missing?.status());
  await expect(page.getByRole("heading", { name: "Catalog Product not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to the Catalog shelf" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(page.getByText("Scarlet & Violet—151")).toHaveCount(0);

  await page.goto(`/products/${archivedSlug}`);
  await expect(page.getByRole("heading", { name: "Catalog Product not found" })).toBeVisible();
  await expect(page.getByText("Archived Browser Fixture")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
});

test("renders and refines a responsive deterministic 500-product shelf accessibly", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("500 results");
  expect(await page.getByRole("heading", { name: "Exact Spacing" }).textContent()).toBe("  Exact  Spacing  ");

  const missing = page.getByRole("link", { name: new RegExp(`No Name.*Unknown number.*${fixtureDesign}`) });
  await expect(missing).toContainText("Unknown set");
  await expect(missing).toContainText("Unknown rarity");
  await expect(missing.getByText("Preview coming soon")).toBeVisible();

  const localRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (request.resourceType() !== "image" && !url.startsWith("https://vercel.live/") && url !== page.url()) localRequests.push(url);
  });
  const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
  await search.fill("catalog-test /010");
  await expect(page.getByRole("status")).toHaveText("1 result");
  await page.getByRole("button", { name: "Reset filters" }).first().click();

  await page.getByRole("checkbox", { name: "AR", exact: true }).check();
  await page.getByRole("checkbox", { name: "SR", exact: true }).check();
  await page.getByRole("checkbox", { name: "Toploader" }).check();
  await page.getByRole("spinbutton", { name: "Minimum" }).fill("70000");
  await page.getByRole("spinbutton", { name: "Maximum" }).fill("70500");
  await expect(page.getByRole("status")).not.toHaveText("0 results");
  await page.getByRole("combobox", { name: "Sort by" }).selectOption("price-desc");
  await expect(page).toHaveURL("/");
  expect(localRequests).toEqual([]);

  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByRole("searchbox", { name: "Search Catalog Products" })).toBeVisible();
  const mobileFilters = page.getByText("Filters and sort");
  await expect(mobileFilters).toBeVisible();
  await mobileFilters.click();
  await expect(page.getByRole("checkbox", { name: "Toploader" })).not.toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Search Catalog Products" })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 568 });
  const overflowingElements = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")]
    .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
    .slice(0, 10)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return `${element.tagName.toLowerCase()}.${element.className} left=${rect.left} right=${rect.right} width=${rect.width}`;
    }));
  expect(await overflowingElements()).toEqual([]);
  await page.setViewportSize({ width: 812, height: 375 });
  expect(await overflowingElements()).toEqual([]);
});
