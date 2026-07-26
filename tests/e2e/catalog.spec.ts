import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { Pool } from "pg";

const webhookSecret = process.env.CATALOG_REVALIDATE_SECRET;

test("accepts only authenticated fixed-scope Catalog invalidation events", async ({ request }) => {
  expect(webhookSecret).toBeTruthy();
  const endpoint = "/api/catalog/invalidate";
  expect((await request.get(endpoint)).status()).toBe(405);
  expect((await request.post(endpoint, { data: {} })).status()).toBe(401);
  expect((await request.post(endpoint, {
    headers: { authorization: `Bearer ${webhookSecret}` },
    data: { type: "UPDATE", schema: "public", table: "other" },
  })).status()).toBe(400);
  expect((await request.post(endpoint, {
    headers: { authorization: `Bearer ${webhookSecret}` },
    data: { type: "UPDATE", schema: "catalog_private", table: "catalog_products", tag: "caller-tag" },
  })).status()).toBe(400);
  for (const table of ["catalog_products", "product_preview_rights", "product_preview_configuration"]) {
    const accepted = await request.post(endpoint, {
      headers: { authorization: `Bearer ${webhookSecret}` },
      data: { type: "UPDATE", schema: "catalog_private", table },
    });
    expect(accepted.status()).toBe(200);
    expect(accepted.headers()["x-correlation-id"]).toMatch(/^[a-f0-9-]{36}$/);
    expect(await accepted.json()).toEqual({ revalidated: true });
  }
});

test("publishes a Dashboard-equivalent insert and edit without deployment", async ({ page, request }) => {
  test.setTimeout(90_000);
  const adminDatabaseUrl = process.env.SUPABASE_ADMIN_DATABASE_URL;
  expect(adminDatabaseUrl).toBeTruthy();
  expect(webhookSecret).toBeTruthy();
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const collectorNumber = `dashboard-${Date.now()}`;
  const inserted = await admin.query<{ id: string; slug: string }>(
    `insert into catalog_private.catalog_products
      (collector_number, design_name, format_code, toploader_price)
     values ($1, 'Dashboard Rehearsal', 'TL', 120000)
     returning id, slug`,
    [collectorNumber],
  );
  const event = (type: "INSERT" | "UPDATE" | "DELETE") => request.post("/api/catalog/invalidate", {
    headers: { authorization: `Bearer ${webhookSecret}` },
    data: { type, schema: "catalog_private", table: "catalog_products" },
  });

  try {
    expect((await event("INSERT")).status()).toBe(200);
    await page.goto("/");
    const insertedRow = page.getByRole("article", { name: `No Name ${collectorNumber}` });
    await expect(insertedRow).toContainText("Unknown set", { timeout: 60_000 });
    await expect(insertedRow).toContainText("Unknown rarity");
    await expect(insertedRow).toContainText("Toploader");
    await expect(insertedRow).toContainText(/Rp\s?120\.000/);

    const edited = await admin.query<{ slug: string }>(
      `update catalog_private.catalog_products
       set card_name = 'Dashboard Eevee', set_name = 'Dashboard Set', rarity_code = 'SR',
           format_code = 'ALL', binder_sleeve_price = 95000
       where id = $1 returning slug`,
      [inserted.rows[0].id],
    );
    expect(edited.rows[0].slug).toBe(inserted.rows[0].slug);

    await expect(async () => {
      await page.reload();
      const editedRow = page.getByRole("article", { name: `Dashboard Eevee ${collectorNumber}` });
      await expect(editedRow).toContainText("Dashboard Set");
      await expect(editedRow).toContainText("SR");
      await expect(editedRow).toContainText("Binder Sleeve");
      await expect(editedRow).toContainText(/Rp\s?95\.000/);
    }).toPass({ timeout: 60_000, intervals: [1_000] });
  } finally {
    await admin.query("delete from catalog_private.catalog_products where id = $1", [inserted.rows[0].id]);
    await event("DELETE");
    await admin.end();
  }
});

test("renders the seeded Catalog Product through the database-to-shelf path", async ({ page, request }) => {
  test.setTimeout(60_000);
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
