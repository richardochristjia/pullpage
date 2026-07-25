import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

const fixtureDesign = `Browser Fixture ${Date.now()}`;
const fixtureCollectorPrefix = `browser-${Date.now()}`;
const webhookSecret = process.env.CATALOG_REVALIDATE_SECRET;
let admin: Pool;
let archivedSlug: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  admin = new Pool({ connectionString: process.env.SUPABASE_ADMIN_DATABASE_URL });
  await admin.query("delete from catalog_private.catalog_products where design_name like 'Browser Fixture %'");
  await admin.query(
    `insert into catalog_private.catalog_products
      (card_name, collector_number, set_name, rarity_code, design_name, format_code,
       binder_sleeve_price, toploader_price)
     select
       case when n = 499 then null when n = 1 then '  Exact  Spacing  ' else 'Catalog Test ' || lpad(n::text, 3, '0') end,
       case when n = 499 then null else $1 || '-' || n end,
       case when n % 10 = 0 or n = 499 then null else 'Synthetic Set ' || (n % 5) end,
       case when n % 11 = 0 or n = 499 then null else
         (array['C','U','R','RR','AR','SR','SAR','UR'])[(n % 8) + 1] end,
       $2,
       case when n % 3 = 0 then 'BS' when n % 3 = 1 then 'TL' else 'ALL' end,
       case when n % 3 in (0, 2) then 50000 + n else null end,
       case when n % 3 in (1, 2) then 70000 + n else null end
     from generate_series(1, 499) n`,
    [fixtureCollectorPrefix, fixtureDesign],
  );
  const archived = await admin.query<{ slug: string }>(
    `insert into catalog_private.catalog_products
      (card_name, collector_number, design_name, format_code, binder_sleeve_price, archived_at)
     values ('Archived Browser Fixture', $1, $2, 'BS', 50000, now()) returning slug`,
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
  await admin.query("delete from catalog_private.catalog_products where design_name = $1", [fixtureDesign]);
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
  page.on("request", (request) => requests.push(request.url()));

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
  const direct = await noScript.newPage();
  await direct.goto(new URL(href!, "http://127.0.0.1:3000").toString());
  await expect(direct.getByRole("heading", { level: 1, name: "Pikachu — Electric Bloom" })).toBeVisible();
  await expect(direct.getByText("Scarlet & Violet—151")).toBeVisible();
  await expect(direct.getByText("Preview coming soon")).toBeVisible();
  await expect(direct.getByRole("dialog")).toHaveCount(0);

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
  page.on("request", (request) => localRequests.push(request.url()));
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
