import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("renders the seeded Catalog Product through the database-to-shelf path", async ({ page, request }) => {
  const browserRequests: string[] = [];
  page.on("request", (request) => browserRequests.push(request.url()));

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "The Pullpage Catalog" })).toBeVisible();
  const product = page.getByRole("article", { name: "Pikachu 173/165" });
  await expect(product).toContainText("Electric Bloom");
  await expect(product).toContainText("Binder Sleeve");
  await expect(product).toContainText(/Rp\s?95\.000/);
  await expect(product.getByText("Preview coming soon")).toBeVisible();

  expect(browserRequests).not.toContainEqual(expect.stringMatching(/5432|supabase|postgres/i));

  const browserScripts = await page.locator("script[src]").evaluateAll((scripts) =>
    scripts.map((script) => (script as HTMLScriptElement).src),
  );
  for (const scriptUrl of browserScripts) {
    const source = await (await request.get(scriptUrl)).text();
    expect(source).not.toMatch(/CATALOG_DATABASE_URL|PrismaClient|@prisma|54322/);
  }

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
