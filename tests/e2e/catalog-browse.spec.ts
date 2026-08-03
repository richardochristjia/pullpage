import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("searches, filters, sorts, and opens the deterministic local Catalog accessibly", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("480 results");
  await expect(page.locator("[data-product-slug]")).toHaveCount(24);
  await page.getByRole("button", { name: "Load more Catalog Products" }).click();
  await expect(page.locator("[data-product-slug]")).toHaveCount(48);

  await page.getByRole("button", { name: "Collapse catalog filters" }).click();
  await expect(page.getByRole("button", { name: "Expand catalog filters" })).toBeVisible();
  await page.getByRole("button", { name: "Expand catalog filters" }).click();

  const gridView = page.getByRole("radio", { name: "Grid view" });
  const listView = page.getByRole("radio", { name: "List view" });
  await expect(gridView).toBeChecked();
  await listView.click();
  await expect(page).toHaveURL(/view=list/);

  const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
  await search.fill("pika-chu");
  await expect(page.getByRole("status")).toHaveText("1 result");
  const pikachu = page.getByRole("link", { name: /Pikachu.*173\/165.*Electric Bloom/ });
  await expect(pikachu).toContainText("Scarlet & Violet—151");

  await pikachu.focus();
  await pikachu.click();
  const dialog = page.getByRole("dialog", { name: "Pikachu — Electric Bloom" });
  await expect(dialog).toContainText("Binder Sleeve");
  await expect(page.getByRole("button", { name: "Close product details" })).toBeFocused();
  await expect(page.locator("#app-content")).toHaveAttribute("inert", "");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "View full image" }).click();
  await expect(page.getByRole("dialog", { name: "Full Product Preview" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe("pika-chu");
  await expect(search).toHaveValue("pika-chu");
  await expect(pikachu).toBeFocused();

  await search.fill("does-not-exist");
  await expect(page.getByRole("heading", { name: "No Catalog Products match" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByRole("status")).toHaveText("480 results");

  await page.getByRole("checkbox", { name: "AR", exact: true }).check();
  await page.getByRole("radio", { name: "Toploader" }).click();
  await page.getByRole("spinbutton", { name: "Minimum" }).fill("70000");
  await page.getByRole("spinbutton", { name: "Maximum" }).fill("70500");
  await expect(page.getByRole("status")).not.toHaveText("0 results");
  await page.getByRole("combobox", { name: "Sort by" }).click();
  await page.getByRole("option", { name: "Price: high to low" }).click();
  const viewState = new URL(page.url()).searchParams;
  expect(viewState.get("format")).toBe("toploader");
  expect(viewState.get("sort")).toBe("price-desc");
  expect(viewState.get("min")).toBe("70000");
  expect(viewState.get("max")).toBe("70500");
});

test("renders missing optional facts and excludes inactive Catalog Products", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: "Search Catalog Products" }).fill("synthetic browser fixture");

  const missing = page.getByRole("link", { name: /No Name.*Unknown number.*Synthetic Browser Fixture/ });
  await expect(missing).toContainText("Unknown set");
  await expect(missing).toContainText("Unknown rarity");
  await expect(missing.getByText("Preview coming soon")).toBeVisible();
  await expect(page.getByText("Inactive Browser Fixture")).toHaveCount(0);
});

test("delivers an HTTPS Product Preview directly and falls back after failed delivery", async ({ page }) => {
  const previewRequests: string[] = [];
  await page.route("https://res.cloudinary.com/**", async (route) => {
    previewRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng });
  });

  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
  await search.fill("catalog test 004");
  const product = page.getByRole("link", { name: /Catalog Test 004.*synthetic-browser-4/ });
  const image = product.locator("img");
  await expect(image).toBeVisible();
  await expect(image).toHaveCSS("object-fit", "contain");
  const source = await image.getAttribute("src");
  expect(source).toMatch(/^https:\/\/res[.]cloudinary[.]com\//);
  expect(source).not.toContain("/_next/image");
  expect(previewRequests).toEqual([source]);

  await page.unroute("https://res.cloudinary.com/**");
  let failedAttempts = 0;
  await page.route("https://res.cloudinary.com/**", async (route) => {
    failedAttempts += 1;
    await route.abort("blockedbyclient");
  });
  await page.reload();
  await search.fill("catalog test 004");
  await expect(product.getByLabel("Product Preview unavailable")).toBeVisible();
  expect(failedAttempts).toBe(1);
});

test("defaults to dark and persists the visitor's light theme", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
});

test("keeps the responsive Catalog within narrow viewports", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await expect(page.getByRole("searchbox", { name: "Search Catalog Products" })).toBeVisible();
  await page.getByRole("button", { name: "Filters" }).click();
  const filters = page.getByRole("dialog", { name: "Filter Catalog Products" });
  await expect(filters).toBeVisible();
  await filters.getByRole("radio", { name: "Toploader" }).click();
  await filters.getByRole("button", { name: /Show \d+ products/ }).click();
  await expect(filters).toBeHidden();
  await expect.poll(() => new URL(page.url()).searchParams.get("format")).toBe("toploader");

  const overflowingElements = () => page.evaluate(() => [...document.querySelectorAll<HTMLElement>("body *")]
    .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
    .slice(0, 10)
    .map((element) => element.tagName.toLowerCase()));
  expect(await overflowingElements()).toEqual([]);

  await page.setViewportSize({ width: 812, height: 375 });
  await page.waitForTimeout(250);
  expect(await overflowingElements()).toEqual([]);
});
