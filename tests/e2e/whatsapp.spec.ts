import { expect, test } from "@playwright/test";

test.describe("WhatsApp sales CTA on Catalog Product detail", () => {
  test("renders the Order via WhatsApp anchor with a wa.me URL whose decoded text carries the dialog heading, every Format Option price, and the canonical URL", async ({ page, context }) => {
    test.skip(!process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, "requires NEXT_PUBLIC_WHATSAPP_NUMBER to be configured for this environment");

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
    await search.fill("aggron");
    const aggron = page.getByRole("link", { name: /Aggron — Regional printing unknown — 5ban Graphics/ });
    await expect(aggron).toBeVisible();
    await aggron.click();

    const dialog = page.getByRole("dialog");
    const heading = (await dialog.getByRole("heading", { level: 2 }).first().textContent())?.trim();
    expect(heading).toBeTruthy();

    const cta = dialog.getByRole("link", { name: "Order via WhatsApp" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("target", "_blank");
    await expect(cta).toHaveAttribute("rel", /noopener/);

    const href = await cta.getAttribute("href");
    expect(href).not.toBeNull();
    const url = new URL(href!);
    expect(url.origin + url.pathname).toBe(`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`);
    const text = url.searchParams.get("text");
    expect(text).not.toBeNull();
    const lines = text!.split("\n");
    expect(lines[0]).toBe(`Hi Kak! I'd like to order ${heading}`);
    expect(lines.at(-1)).toMatch(/^https:\/\/pullpage\.vercel\.app\/products\//);

    const bodyFormatLines = lines.slice(1, -1);
    expect(bodyFormatLines.length).toBeGreaterThan(0);
    for (const line of bodyFormatLines) {
      expect(line).toMatch(/^(Binder Sleeve|Toploader): Rp[\s ]?[\d.]+$/);
    }
  });

  test("keeps the Copy link button alongside the WhatsApp CTA inside the share section", async ({ page, context }) => {
    test.skip(!process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, "requires NEXT_PUBLIC_WHATSAPP_NUMBER to be configured for this environment");

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
    await search.fill("aggron");
    const aggron = page.getByRole("link", { name: /Aggron — Regional printing unknown — 5ban Graphics/ });
    await aggron.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Copy link" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Order via WhatsApp" })).toBeVisible();
  });

  test("no longer renders the navigator.share Share button", async ({ page }) => {
    test.skip(!process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, "requires NEXT_PUBLIC_WHATSAPP_NUMBER to be configured for this environment");

    await page.goto("/");
    const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
    await search.fill("aggron");
    const aggron = page.getByRole("link", { name: /Aggron — Regional printing unknown — 5ban Graphics/ });
    await aggron.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Share" })).toHaveCount(0);
  });
});