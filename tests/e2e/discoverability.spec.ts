import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const canonicalPattern = /^https:\/\/pullpage[.]vercel[.]app\/products\/pikachu-[a-z0-9-]+$/;
const webhookSecret = process.env.CATALOG_REVALIDATE_SECRET;
const fixturePreviewUrl = "https://res.cloudinary.com/pullpage-discoverability/image/upload/v1700000077/catalog-products/discoverability/social.png";
let admin: Pool;
let fixtureId: string;
let fixtureSlug: string;
let fixtureRightsId: string | undefined;
let previousConfiguration: { environment_name: string; cloud_name: string; asset_folder: string; created_at: Date; updated_at: Date } | null;

const invalidate = (request: APIRequestContext, table = "catalog_products") => request.post("/api/catalog/invalidate", {
  headers: { authorization: `Bearer ${webhookSecret}` },
  data: { type: "UPDATE", schema: "catalog_private", table },
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
    "insert into catalog_private.product_preview_configuration (environment_name, cloud_name) values ('discoverability-test', 'pullpage-discoverability')",
  );
  const fixture = await admin.query<{ id: string; slug: string }>(`
    insert into catalog_private.catalog_products
      (card_name, collector_number, design_name, format_code, binder_sleeve_price)
    values ('Discoverability Fixture', 'seo-${Date.now()}', 'Initial Design', 'BS', 91000)
    returning id, slug
  `);
  fixtureId = fixture.rows[0].id;
  fixtureSlug = fixture.rows[0].slug;
  expect((await invalidate(request)).status()).toBe(200);
});

test.afterAll(async ({ request }) => {
  await admin.query("delete from catalog_private.catalog_products where id = $1", [fixtureId]);
  if (fixtureRightsId) await admin.query("delete from catalog_private.product_preview_rights where id = $1", [fixtureRightsId]);
  await admin.query("delete from catalog_private.product_preview_configuration");
  if (previousConfiguration) {
    await admin.query(
      `insert into catalog_private.product_preview_configuration
        (environment_name, cloud_name, asset_folder, created_at, updated_at)
       values ($1, $2, $3, $4, $5)`,
      [previousConfiguration.environment_name, previousConfiguration.cloud_name, previousConfiguration.asset_folder,
        previousConfiguration.created_at, previousConfiguration.updated_at],
    );
  }
  await invalidate(request);
  await admin.end();
});

test("shares the immutable production canonical through native Web Share", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        (window as typeof window & { sharedProduct?: ShareData }).sharedProduct = data;
      },
    });
  });
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search Catalog Products" }).fill("pikachu");
  const href = await page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ }).getAttribute("href");
  await page.goto(href!);
  await page.getByRole("button", { name: "Share Catalog Product" }).click();

  const shared = await page.evaluate(() => (window as typeof window & { sharedProduct?: ShareData }).sharedProduct);
  expect(shared?.url).toMatch(canonicalPattern);
  const deploymentOrigin = new URL(process.env.CATALOG_TEST_ORIGIN ?? page.url()).origin;
  if (deploymentOrigin !== "https://pullpage.vercel.app") {
    expect(shared?.url).not.toContain(deploymentOrigin);
  }
  expect(shared?.title).toBe("Pikachu — Electric Bloom | Pullpage");
  await expect(page.getByRole("heading", { level: 1, name: "Pikachu — Electric Bloom" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("announces clipboard success and preserves recoverable state when clipboard access fails", async ({ page }) => {
  await page.addInitScript(() => {
    (window as typeof window & { clipboardMode: "success" | "failure"; copiedProduct?: string }).clipboardMode = "success";
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          const state = window as typeof window & { clipboardMode: "success" | "failure"; copiedProduct?: string };
          if (state.clipboardMode === "failure") throw new Error("clipboard denied");
          state.copiedProduct = value;
        },
      },
    });
  });
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
  await search.fill("pikachu");
  await page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ }).click();
  const dialog = page.getByRole("dialog", { name: "Pikachu — Electric Bloom" });
  const share = dialog.getByRole("button", { name: "Share Catalog Product" });

  await share.click();
  await expect(dialog.getByRole("status")).toHaveText("Canonical product link copied.");
  expect(await page.evaluate(() => (window as typeof window & { copiedProduct?: string }).copiedProduct)).toMatch(canonicalPattern);
  await expect(dialog.getByText("Copy the canonical link manually:" )).toHaveCount(0);

  await page.evaluate(() => ((window as typeof window & { clipboardMode: "success" | "failure" }).clipboardMode = "failure"));
  await share.click();
  await expect(dialog.getByRole("status")).toHaveText("Clipboard access failed. Copy the canonical link manually below.");
  const recovery = dialog.getByRole("textbox", { name: "Canonical product link" });
  await expect(recovery).toHaveValue(canonicalPattern);
  await expect(recovery).toBeFocused();
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/products\/pikachu-/);

  await page.goBack();
  await expect(search).toHaveValue("pikachu");
});

test("serves fixed production metadata and robots to browsers and crawlers", async ({ browser, request }) => {
  const rootContext = await browser.newContext({ javaScriptEnabled: false });
  const root = await rootContext.newPage();
  await root.goto("/");
  await expect(root).toHaveTitle("Pullpage");
  await expect(root.locator("html")).toHaveAttribute("lang", "en");
  await expect(root.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Browse Pullpage's read-only catalog of extended card art for card binders.",
  );
  await expect(root.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_US");
  await expect(root.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://pullpage.vercel.app");
  await rootContext.close();

  const path = `/products/${fixtureSlug}`;
  const userAgents = [
    "Mozilla/5.0 Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  ];
  for (const userAgent of userAgents) {
    const externalBrowser = Boolean(process.env.CATALOG_TEST_ORIGIN) && userAgent.includes("Chrome/123");
    const context = await browser.newContext({
      javaScriptEnabled: externalBrowser,
      userAgent,
      extraHTTPHeaders: { "user-agent": userAgent },
    });
    if (process.env.CATALOG_TEST_ORIGIN && !externalBrowser) {
      const response = await fetch(new URL(path, process.env.CATALOG_TEST_ORIGIN), { headers: { "user-agent": userAgent } });
      const html = await response.text();
      expect(response.status).toBe(200);
      expect(html).toContain("Discoverability Fixture — Initial Design | Pullpage");
      expect(html).toContain(`href="https://pullpage.vercel.app${path}"`);
      expect(html).toContain('property="og:type" content="website"');
      expect(html).toContain('property="og:locale" content="en_US"');
      expect(html).toContain('property="og:image" content="https://pullpage.vercel.app/pullpage-social.png"');
      expect(html).toContain('property="og:image:width" content="1200"');
      expect(html).toContain('property="og:image:height" content="630"');
      expect(html).toContain('name="twitter:card" content="summary_large_image"');
      expect(html).toContain('name="robots" content="index, follow"');
      if (userAgent.startsWith("facebookexternalhit")) {
        expect(html.indexOf('property="og:title"')).toBeGreaterThan(0);
        expect(html.indexOf('property="og:title"')).toBeLessThan(html.indexOf("</head>"));
      }
    } else {
      const page = await context.newPage();
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle("Discoverability Fixture — Initial Design | Pullpage");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://pullpage.vercel.app${path}`);
      await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");
      await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_US");
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://pullpage.vercel.app/pullpage-social.png");
      await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
      await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/);
    }
    await context.close();
  }

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toBe(
    "User-Agent: *\nAllow: /\n\nSitemap: https://pullpage.vercel.app/sitemap.xml\n",
  );
});

test("updates metadata and the runtime sitemap after valid edits, preview approval, and archival", async ({ page, request }) => {
  test.setTimeout(60_000);
  const canonical = `https://pullpage.vercel.app/products/${fixtureSlug}`;
  const initialSitemap = await (await request.get("/sitemap.xml")).text();
  expect(initialSitemap).toContain(`<loc>${canonical}</loc>`);
  expect(initialSitemap).not.toContain("<lastmod>");
  expect(initialSitemap).not.toContain("<changefreq>");
  expect(initialSitemap).not.toContain("<priority>");

  await admin.query(
    `update catalog_private.catalog_products
     set card_name = 'Edited Discoverability Product', design_name = 'Current Design',
         set_name = 'Known Set', rarity_code = 'UR', format_code = 'ALL', toploader_price = 84000
     where id = $1`,
    [fixtureId],
  );
  expect((await invalidate(request)).status()).toBe(200);
  await page.goto(`/products/${fixtureSlug}`);
  await expect(page).toHaveTitle("Edited Discoverability Product — Current Design | Pullpage");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Known Set.*UR.*Lowest price Rp 84\.000/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Edited Discoverability Product — Current Design");

  const rights = await admin.query<{ id: string }>(`
    insert into catalog_private.product_preview_rights (
      exact_versioned_url, asset_identifier, source, creator_photographer, owner_licensor,
      permission_basis, permission_evidence, channels, territories, attribution_required,
      effective_on, status, reviewer, reviewed_at
    ) values ($1, 'discoverability-social-v1', 'commission', 'Fixture Creator', 'Pullpage',
      'written permission', 'fixture evidence', array['catalog', 'social'], array['ID'], false,
      current_date, 'approved', 'Fixture Reviewer', statement_timestamp())
    returning id
  `, [fixturePreviewUrl]);
  fixtureRightsId = rights.rows[0].id;
  await admin.query(
    `update catalog_private.catalog_products
     set product_preview_url = $1, product_preview_rights_id = $2 where id = $3`,
    [fixturePreviewUrl, fixtureRightsId, fixtureId],
  );
  expect((await invalidate(request)).status()).toBe(200);

  await page.goto(`/products/${fixtureSlug}`);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://res.cloudinary.com/pullpage-discoverability/image/upload/f_jpg,q_auto,c_pad,w_1200,h_630,b_rgb:08111f/v1700000077/catalog-products/discoverability/social.png",
  );
  const previewSitemap = await (await request.get("/sitemap.xml")).text();
  expect(previewSitemap).toContain(`<image:loc>${fixturePreviewUrl}</image:loc>`);

  await admin.query("update catalog_private.catalog_products set archived_at = statement_timestamp() where id = $1", [fixtureId]);
  expect((await invalidate(request)).status()).toBe(200);
  const archivedSitemap = await (await request.get("/sitemap.xml")).text();
  expect(archivedSitemap).not.toContain(canonical);
  const archived = await page.goto(`/products/${fixtureSlug}`);
  expect([200, 404]).toContain(archived?.status());
  await expect(page.getByRole("heading", { name: "Catalog Product not found" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Pullpage");
  await expect(page.locator('meta[property="og:title"]')).not.toHaveAttribute("content", /Edited Discoverability/);
});
