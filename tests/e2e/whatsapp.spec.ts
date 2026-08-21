import { expect, test } from "@playwright/test";

test.describe("WhatsApp sales CTA on Catalog Product detail", () => {
  test("renders the Order via WhatsApp anchor with a wa.me URL whose decoded text carries the dialog heading, every Format Option price, and the canonical URL", async ({ page, context }) => {
    test.skip(!process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, "requires NEXT_PUBLIC_WHATSAPP_NUMBER to be configured for this environment");

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
    await search.fill("pikachu");
    const pikachu = page.getByRole("link", { name: /Pikachu.*English Printing 173\/165.*Japanese Printing 205\/165.*Electric Bloom/ });
    await expect(pikachu).toBeVisible();
    await pikachu.click();

    const dialog = page.getByRole("dialog", { name: "Pikachu — Electric Bloom" });
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
    expect(lines[0]).toBe("Hi Kak! I'd like to order Pikachu — Electric Bloom");
    expect(lines.at(-1)).toMatch(/^https:\/\/pullpage\.vercel\.app\/products\/pikachu/);
    expect(text).toMatch(/Binder Sleeve: Rp[\s ]?95\.000/);
    expect(text).not.toContain("Toploader");
  });

  test("keeps the Copy link button alongside the WhatsApp CTA inside the share section", async ({ page, context }) => {
    test.skip(!process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, "requires NEXT_PUBLIC_WHATSAPP_NUMBER to be configured for this environment");

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
    await search.fill("pikachu");
    const pikachu = page.getByRole("link", { name: /Pikachu.*English Printing 173\/165.*Japanese Printing 205\/165.*Electric Bloom/ });
    await pikachu.click();

    const dialog = page.getByRole("dialog", { name: "Pikachu — Electric Bloom" });
    await expect(dialog.getByRole("button", { name: "Copy link" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Order via WhatsApp" })).toBeVisible();
  });

  test("no longer renders the navigator.share Share button", async ({ page }) => {
    test.skip(!process.env.NEXT_PUBLIC_WHATSAPP_NUMBER, "requires NEXT_PUBLIC_WHATSAPP_NUMBER to be configured for this environment");

    await page.goto("/");
    const search = page.getByRole("searchbox", { name: "Search Catalog Products" });
    await search.fill("pikachu");
    const pikachu = page.getByRole("link", { name: /Pikachu.*English Printing 173\/165.*Japanese Printing 205\/165.*Electric Bloom/ });
    await pikachu.click();

    const dialog = page.getByRole("dialog", { name: "Pikachu — Electric Bloom" });
    await expect(dialog.getByRole("button", { name: "Share" })).toHaveCount(0);
  });
});
