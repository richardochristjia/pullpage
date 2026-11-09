import { expect, test } from "@playwright/test";

const productionOrigin = "https://pullpage.vercel.app";

test("serves immutable product canonicals, metadata, robots, and sitemap entries", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", productionOrigin);
  await page.getByRole("searchbox", { name: "Search Catalog Products" }).fill("pikachu");
  const pikachuHref = await page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ }).getAttribute("href");
  expect(pikachuHref).toMatch(/^\/products\/pikachu-[a-z0-9-]+$/);

  await page.goto(pikachuHref!);
  await expect(page).toHaveTitle("Pikachu — Electric Bloom | Pullpage");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${productionOrigin}${pikachuHref}`);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", `${productionOrigin}/pullpage-social.png`);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/);

  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search Catalog Products" }).fill("catalog test 004");
  const previewHref = await page.getByRole("link", { name: /Catalog Test 004.*synthetic-browser-4/ }).getAttribute("href");
  await page.goto(previewHref!);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /res[.]cloudinary[.]com\/pullpage-synthetic\/image\/upload\/f_jpg,q_auto,c_pad,w_1200,h_630,b_rgb:08111f\/v1\/catalog-products\/synthetic-preview[.]webp/,
  );

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const sitemapXml = await sitemap.text();
  expect(sitemapXml).toContain(`<loc>${productionOrigin}${pikachuHref}</loc>`);
  expect(sitemapXml).toContain(`<loc>${productionOrigin}${previewHref}</loc>`);
  expect(sitemapXml).toContain("<image:loc>https://res.cloudinary.com/pullpage-synthetic/image/upload/v1/catalog-products/synthetic-preview.webp</image:loc>");
  expect(sitemapXml).not.toContain("Inactive Browser Fixture");

  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toBe(
    `User-Agent: *\nAllow: /\n\nSitemap: ${productionOrigin}/sitemap.xml\n`,
  );
});

test("preserves a manual clipboard fallback for the production canonical", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => { throw new Error("clipboard denied"); } },
    });
  });

  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search Catalog Products" }).fill("pikachu");
  await page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ }).click();
  const dialog = page.getByRole("dialog", { name: "Pikachu — Electric Bloom" });
  await dialog.getByRole("button", { name: "Copy link" }).click();
  await expect(page.getByText("Clipboard access failed. Copy the link manually.")).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Canonical product link" })).toHaveValue(
    /^https:\/\/pullpage[.]vercel[.]app\/products\/pikachu-[a-z0-9-]+$/,
  );
});

test("renders a complete canonical route for crawlers and a branded miss without JavaScript", async ({ browser, page }) => {
  await page.goto("/?q=pikachu");
  const href = await page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ }).getAttribute("href");
  // shortcut: Next.js only waits for full HTML for known bots, so a JavaScript-free browser still sees the Suspense fallback until the product page stops streaming.
  const noScript = await browser.newContext({
    javaScriptEnabled: false,
    userAgent: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  });
  const direct = await noScript.newPage();
  await direct.goto(href!);
  await expect(direct.getByRole("heading", { level: 1, name: "Pikachu — Electric Bloom" })).toBeVisible();
  await expect(direct.getByText("Scarlet & Violet—151")).toBeVisible();
  await expect(direct.getByRole("dialog")).toHaveCount(0);
  await noScript.close();

  const missing = await page.goto("/products/not-a-catalog-product-deadbeef");
  expect([200, 404]).toContain(missing?.status());
  await expect(page.getByRole("heading", { name: "Catalog Product not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return to the Catalog shelf" })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
});
