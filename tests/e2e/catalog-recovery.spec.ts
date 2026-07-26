import { expect, test } from "@playwright/test";
import { Pool } from "pg";

const adminDatabaseUrl = process.env.SUPABASE_ADMIN_DATABASE_URL;
const webhookSecret = process.env.CATALOG_REVALIDATE_SECRET;
if (!adminDatabaseUrl || !webhookSecret) throw new Error("Catalog recovery credentials are required");

test("targeted recovery preserves later work and converges every public Catalog output", async ({ page, request }) => {
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const marker = `recovery-${Date.now()}`;
  let productId: string | undefined;
  let slug: string | undefined;

  try {
    const inserted = await admin.query<{ id: string; slug: string }>(`
      insert into catalog_private.catalog_products
        (card_name, collector_number, set_name, format_code, binder_sleeve_price)
      values ('Recovered Catalog Product', $1, 'Original Recovery Set', 'BS', 97000)
      returning id, slug
    `, [marker]);
    productId = inserted.rows[0].id;
    slug = inserted.rows[0].slug;
    await admin.query("update catalog_private.catalog_products set card_name = 'Mistaken Catalog Product' where id = $1", [productId]);
    const mistake = await admin.query<{ journal_id: string }>(`
      select journal_id from catalog_private.catalog_product_journal_for_product($1)
      where operation = 'UPDATE' order by journal_id desc limit 1
    `, [productId]);
    await admin.query("update catalog_private.catalog_products set set_name = 'Later Valid Recovery Set' where id = $1", [productId]);

    const client = await admin.connect();
    try {
      await client.query("begin");
      await client.query("set local role catalog_recovery_operator");
      await client.query(
        "select catalog_private.recover_catalog_product_fields($1, $2, $3, $4, $5)",
        [productId, mistake.rows[0].journal_id, ["card_name"], "Browser recovery qualification", ["Primary Recovery Owner", "Backup Recovery Owner"]],
      );
      await client.query("commit");
    } finally {
      client.release();
    }

    const invalidation = await request.post("/api/catalog/invalidate", {
      headers: { authorization: `Bearer ${webhookSecret}` },
      data: { type: "UPDATE", schema: "catalog_private", table: "catalog_products", commit_timestamp: new Date().toISOString() },
    });
    expect(invalidation.status()).toBe(200);

    await page.goto("/");
    await expect(page.getByText("Recovered Catalog Product").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Later Valid Recovery Set").first()).toBeVisible();
    await expect(page.getByText("Mistaken Catalog Product")).toHaveCount(0);

    await page.locator(`a[href="/products/${slug}"]`).first().click();
    const modal = page.getByRole("dialog");
    await expect(modal.getByRole("heading", { name: "Recovered Catalog Product" })).toBeVisible();
    await expect(modal.getByText("Later Valid Recovery Set")).toBeVisible();
    await expect(modal.getByLabel("Product Preview unavailable")).toBeVisible();
    await page.keyboard.press("Escape");

    const product = await request.get(`/products/${slug}`);
    const productBody = await product.text();
    expect(product.status()).toBe(200);
    expect(productBody).toContain("<title>Recovered Catalog Product");
    expect(productBody).toContain("Later Valid Recovery Set");
    expect(productBody).not.toContain("Mistaken Catalog Product");
    expect((await request.get("/sitemap.xml")).text()).resolves.toContain(`/products/${slug}`);
  } finally {
    if (productId) {
      await admin.query("update catalog_private.catalog_products set archived_at = statement_timestamp() where id = $1", [productId]);
      const client = await admin.connect();
      try {
        await client.query("begin");
        await client.query("set local role catalog_recovery_operator");
        await client.query(
          "select catalog_private.hard_delete_catalog_product($1, $2, $3)",
          [productId, "Remove recovery test data", ["Test Primary", "Test Backup"]],
        );
        await client.query("commit");
      } finally {
        client.release();
      }
    }
    await request.post("/api/catalog/invalidate", {
      headers: { authorization: `Bearer ${webhookSecret}` },
      data: { type: "DELETE", schema: "catalog_private", table: "catalog_products" },
    });
    await admin.end();
  }
});
