import { expect, test } from "@playwright/test";

const productionOrigin = "https://pullpage.vercel.app";

test("serves immutable product canonicals, metadata, robots, and sitemap entries", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${productionOrigin}/`);
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

test("shares the production canonical and preserves a manual clipboard fallback", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as typeof window & { shareMode: "native" | "clipboard-failure"; shared?: ShareData };
    state.shareMode = "native";
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        if (state.shareMode !== "native") throw new Error("share unavailable");
        state.shared = data;
      },
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => { throw new Error("clipboard denied"); } },
    });
  });

  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search Catalog Products" }).fill("pikachu");
  await page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ }).click();
  const dialog = page.getByRole("dialog", { name: "Pikachu — Electric Bloom" });
  const share = dialog.getByRole("button", { name: "Share Catalog Product" });
  await share.click();

  const shared = await page.evaluate(() => (window as typeof window & { shared?: ShareData }).shared);
  expect(shared?.url).toMatch(/^https:\/\/pullpage[.]vercel[.]app\/products\/pikachu-[a-z0-9-]+$/);
  expect(shared?.title).toBe("Pikachu — Electric Bloom | Pullpage");

  await page.evaluate(() => {
    (window as typeof window & { shareMode: "native" | "clipboard-failure" }).shareMode = "clipboard-failure";
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await share.click();
  await expect(dialog.getByRole("status")).toHaveText("Clipboard access failed. Copy the canonical link manually below.");
  await expect(dialog.getByRole("textbox", { name: "Canonical product link" })).toHaveValue(
    /^https:\/\/pullpage[.]vercel[.]app\/products\/pikachu-[a-z0-9-]+$/,
  );
});

test("renders a complete canonical route and branded miss without JavaScript", async ({ browser, page }) => {
  await page.goto("/");
  const href = await page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ }).getAttribute("href");
  const noScript = await browser.newContext({ javaScriptEnabled: false });
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
