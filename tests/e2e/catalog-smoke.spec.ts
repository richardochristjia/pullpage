import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const productionOrigin = "https://pullpage.vercel.app";

test("browses the hosted-compatible Catalog without issuing writes", async ({ page, request }) => {
  const methods: string[] = [];
  page.on("request", (outgoing) => methods.push(outgoing.method()));

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${productionOrigin}/`);
  await expect(page.getByRole("heading", { level: 1, name: "The Pullpage Catalog" })).toBeVisible();
  await expect(page.getByRole("status")).not.toHaveText(/Loading Catalog Products/);

  const productLinks = page.locator('a[href^="/products/"]');
  if (await productLinks.count()) {
    const href = await productLinks.first().getAttribute("href");
    await productLinks.first().click();
    await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    await expect(page.getByRole("dialog")).toBeVisible();

    const sitemap = await request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).toContain(`<loc>${productionOrigin}${href}</loc>`);
  } else {
    await expect(page.getByRole("heading", { name: "No Catalog Products are active yet" })).toBeVisible();
    await expect(page.getByRole("status")).toHaveText("0 results");
  }

  expect(methods.every((method) => method === "GET")).toBe(true);
  expect(methods).not.toContain("POST");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("does not expose the server-side database credential to browser assets", async ({ page, request }) => {
  await page.goto("/");
  const credential = process.env.CATALOG_DATABASE_URL;
  expect(credential).toBeTruthy();
  const url = new URL(credential!);
  const forbidden = [credential!, url.password, encodeURIComponent(url.password)].filter((value) => value.length >= 8);

  const browserText = [await page.content()];
  const scripts = await page.locator("script[src]").evaluateAll((elements) =>
    elements.map((element) => (element as HTMLScriptElement).src),
  );
  for (const source of scripts) {
    const response = await request.get(source);
    if (response.ok()) browserText.push(await response.text());
  }

  for (const value of forbidden) {
    expect(browserText.every((text) => !text.includes(value))).toBe(true);
  }
});
