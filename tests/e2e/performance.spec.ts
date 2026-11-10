import { expect, test, type Page } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const runner = '[title*="3D Pokémon companions"]';

async function servePreviews(page: Page) {
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }));
  await page.route("https://res.cloudinary.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }));
}

test("serves shelf, hero and detail previews resized and the full lightbox as the original", async ({ page }) => {
  await servePreviews(page);
  await page.goto("/", { waitUntil: "networkidle" });

  const shelfImages = page.locator("[data-product-slug] img");
  await expect(shelfImages.first()).toBeVisible();
  for (const src of await shelfImages.evaluateAll((images) => images.map((image) => image.getAttribute("src")))) {
    expect(src).toContain("/_next/image?url=");
  }
  const heroImages = page.locator('[aria-label^="Featured:"] img[alt$="Extended Art"]');
  await expect(heroImages).toHaveCount(3);
  for (const src of await heroImages.evaluateAll((images) => images.map((image) => image.getAttribute("src")))) {
    expect(src).toContain("/_next/image?url=");
  }

  await page.locator("[data-product-slug]").filter({ has: page.locator("img") }).first().click();
  const dialog = page.getByRole("dialog").first();
  await expect(dialog.locator("img").first()).toHaveAttribute("src", /\/_next\/image\?url=/);

  await dialog.getByRole("button", { name: "View full image" }).click();
  const lightbox = page.getByRole("dialog", { name: "Full Product Preview" });
  await expect(lightbox.locator("img")).toHaveAttribute("src", /^https:\/\/res\.cloudinary\.com\//);
});

test("loads exactly one self-hosted model and swaps a single model-viewer after a lap", async ({ page, baseURL }) => {
  await servePreviews(page);
  const models: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".glb")) models.push(request.url());
  });

  await page.goto("/", { waitUntil: "networkidle" });
  // The runner pauses while its track is off-screen, and model-viewer loads only once visible.
  await page.locator(runner).scrollIntoViewIfNeeded();
  const viewer = page.locator("model-viewer");
  await expect(viewer).toHaveCount(1);
  // A model that fails to decode never sets `loaded`, so this times out instead of passing.
  await expect.poll(() => viewer.evaluate((el) => (el as HTMLElement & { loaded?: boolean }).loaded)).toBe(true);

  const before = await viewer.getAttribute("src");
  const shown = new URL(before!, baseURL).href;
  // Besides the shown model, only the next model's warm-up (4 s into the lap) may have started.
  expect(models.filter((url) => url === shown)).toHaveLength(1);
  expect(models.filter((url) => url !== shown).length).toBeLessThanOrEqual(1);
  for (const url of models) {
    expect(new URL(url).origin).toBe(new URL(baseURL!).origin);
    expect(url).not.toContain("raw.githubusercontent.com");
  }

  // Shorten the lap now that the runner is on screen.
  await page.addStyleTag({ content: `${runner} { animation-duration: 0.4s !important; }` });
  await expect.poll(() => viewer.getAttribute("src")).not.toBe(before);
  await expect(viewer).toHaveCount(1);
});

test("shows no looping motion with prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await servePreviews(page);
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.locator(runner)).toHaveCSS("animation-iteration-count", "1");
  const looping = await page.evaluate(() =>
    document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations === Infinity).length);
  expect(looping).toBe(0);
});
