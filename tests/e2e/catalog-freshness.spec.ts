import { expect, test, type APIRequestContext } from "@playwright/test";
import { Pool } from "pg";

const adminDatabaseUrl = process.env.SUPABASE_ADMIN_DATABASE_URL;
const webhookSecret = process.env.CATALOG_REVALIDATE_SECRET;
if (!adminDatabaseUrl || !webhookSecret) throw new Error("Catalog freshness credentials are required");

const invalidate = (request: APIRequestContext, table: string) => request.post("/api/catalog/invalidate", {
  headers: { authorization: `Bearer ${webhookSecret}` },
  data: { type: "UPDATE", schema: "catalog_private", table },
});

test("twenty representative valid transactions converge across the public Catalog within 60 seconds", async ({ request }, testInfo) => {
  test.setTimeout(180_000);
  const admin = new Pool({ connectionString: adminDatabaseUrl });
  const marker = `freshness-${Date.now()}`;
  const previewUrl = "https://res.cloudinary.com/pullpage-freshness/image/upload/v1700000008/catalog-products/freshness/qualification.png";
  const configuration = await admin.query<{
    environment_name: string; cloud_name: string; asset_folder: string; created_at: Date; updated_at: Date;
  }>("select environment_name, cloud_name, asset_folder, created_at, updated_at from catalog_private.product_preview_configuration");
  let productId: string | undefined;
  let slug: string | undefined;
  let rightsId: string | undefined;
  let expectedCardName = "Freshness Product";
  let expectedActive = true;
  let expectedPreview = false;
  const timings: Array<{ operation: string; startedAt: string; convergedAt: string; durationMs: number; correlationId: string | undefined }> = [];

  const observe = async (operation: string, table: string) => {
    const startedAt = new Date();
    const accepted = await invalidate(request, table);
    expect(accepted.status()).toBe(200);
    await expect.poll(async () => {
      const [shelf, product, sitemap] = await Promise.all([
        request.get("/"),
        request.get(`/products/${slug}`),
        request.get("/sitemap.xml"),
      ]);
      const [shelfBody, productBody, sitemapBody] = await Promise.all([shelf.text(), product.text(), sitemap.text()]);
      const activeMatches = expectedActive
        ? shelfBody.includes(marker) && productBody.includes(expectedCardName) && sitemapBody.includes(`/products/${slug}`)
        : !shelfBody.includes(marker) && !productBody.includes(expectedCardName) && !sitemapBody.includes(`/products/${slug}`);
      const previewMatches = expectedPreview ? sitemapBody.includes(previewUrl) : !sitemapBody.includes(previewUrl);
      return activeMatches && previewMatches;
    }, { timeout: 60_000, intervals: Array.from({ length: 120 }, () => 500) }).toBe(true);
    const convergedAt = new Date();
    timings.push({
      operation,
      startedAt: startedAt.toISOString(),
      convergedAt: convergedAt.toISOString(),
      durationMs: convergedAt.getTime() - startedAt.getTime(),
      correlationId: accepted.headers()["x-correlation-id"],
    });
  };

  try {
    await admin.query("delete from catalog_private.product_preview_configuration");
    await admin.query(`insert into catalog_private.product_preview_configuration (environment_name, cloud_name)
      values ('freshness-test', 'pullpage-freshness')`);

    const inserted = await admin.query<{ id: string; slug: string }>(`
      insert into catalog_private.catalog_products
        (card_name, collector_number, set_name, rarity_code, design_name, format_code, binder_sleeve_price)
      values ($1, $2, 'Freshness Set', 'AR', 'Freshness Design', 'BS', 90000)
      returning id, slug
    `, [expectedCardName, marker]);
    productId = inserted.rows[0].id;
    slug = inserted.rows[0].slug;
    await observe("insert Catalog Product", "catalog_products");

    expectedCardName = "Freshness Product Edited";
    await admin.query("update catalog_private.catalog_products set card_name = $2 where id = $1", [productId, expectedCardName]);
    await observe("edit Card Name", "catalog_products");
    await admin.query("update catalog_private.catalog_products set binder_sleeve_price = 91000 where id = $1", [productId]);
    await observe("edit Binder Sleeve price", "catalog_products");
    await admin.query("update catalog_private.catalog_products set format_code = 'ALL', toploader_price = 121000 where id = $1", [productId]);
    await observe("support both binder formats", "catalog_products");
    await admin.query("update catalog_private.catalog_products set binder_sleeve_price = 92000, toploader_price = 122000 where id = $1", [productId]);
    await observe("edit both Format Option prices", "catalog_products");
    await admin.query("update catalog_private.catalog_products set format_code = 'TL', binder_sleeve_price = null where id = $1", [productId]);
    await observe("support Toploader only", "catalog_products");
    await admin.query("update catalog_private.catalog_products set format_code = 'BS', binder_sleeve_price = 93000, toploader_price = null where id = $1", [productId]);
    await observe("support Binder Sleeve only", "catalog_products");
    await admin.query("update catalog_private.catalog_products set rarity_code = 'SR' where id = $1", [productId]);
    await observe("edit Rarity", "catalog_products");
    await admin.query("update catalog_private.catalog_products set rarity_code = null where id = $1", [productId]);
    await observe("clear Rarity", "catalog_products");
    await admin.query("update catalog_private.catalog_products set rarity_code = 'AR' where id = $1", [productId]);
    await observe("restore Rarity", "catalog_products");

    const rights = await admin.query<{ id: string }>(`
      insert into catalog_private.product_preview_rights (
        exact_versioned_url, asset_identifier, source, creator_photographer, owner_licensor,
        permission_basis, permission_evidence, channels, territories, attribution_required,
        effective_on, status, reviewer, reviewed_at
      ) values ($1, 'freshness-v1', 'commission', 'Freshness Creator', 'Pullpage',
        'written permission', 'freshness evidence', array['catalog', 'social'], array['ID'], false,
        current_date, 'approved', 'Freshness Reviewer', statement_timestamp()) returning id
    `, [previewUrl]);
    rightsId = rights.rows[0].id;
    await observe("approve Product Preview rights", "product_preview_rights");
    expectedPreview = true;
    await admin.query("update catalog_private.catalog_products set product_preview_url = $2, product_preview_rights_id = $3 where id = $1", [productId, previewUrl, rightsId]);
    await observe("link Product Preview", "catalog_products");
    expectedPreview = false;
    await admin.query("update catalog_private.product_preview_rights set status = 'rejected' where id = $1", [rightsId]);
    await observe("reject Product Preview rights", "product_preview_rights");
    expectedPreview = true;
    await admin.query("update catalog_private.product_preview_rights set status = 'approved' where id = $1", [rightsId]);
    await observe("restore Product Preview rights", "product_preview_rights");
    expectedPreview = false;
    await admin.query("update catalog_private.product_preview_configuration set cloud_name = 'withdrawn-freshness-cloud'");
    await observe("withdraw Product Preview configuration", "product_preview_configuration");
    expectedPreview = true;
    await admin.query("update catalog_private.product_preview_configuration set cloud_name = 'pullpage-freshness'");
    await observe("restore Product Preview configuration", "product_preview_configuration");
    expectedActive = false;
    expectedPreview = false;
    await admin.query("update catalog_private.catalog_products set archived_at = statement_timestamp() where id = $1", [productId]);
    await observe("archive Catalog Product", "catalog_products");
    expectedActive = true;
    expectedPreview = true;
    await admin.query("update catalog_private.catalog_products set archived_at = null where id = $1", [productId]);
    await observe("restore Catalog Product", "catalog_products");
    expectedPreview = false;
    await admin.query("update catalog_private.catalog_products set product_preview_url = null, product_preview_rights_id = null where id = $1", [productId]);
    await observe("unlink Product Preview", "catalog_products");
    expectedPreview = true;
    await admin.query("update catalog_private.catalog_products set product_preview_url = $2, product_preview_rights_id = $3 where id = $1", [productId, previewUrl, rightsId]);
    await observe("relink Product Preview", "catalog_products");

    const sorted = timings.map(({ durationMs }) => durationMs).sort((a, b) => a - b);
    const report = {
      transactions: timings,
      p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
      p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
      maximumMs: sorted.at(-1),
    };
    expect(timings).toHaveLength(20);
    expect(report.maximumMs).toBeLessThanOrEqual(60_000);
    console.info(`Catalog freshness: p50=${report.p50Ms}ms p95=${report.p95Ms}ms max=${report.maximumMs}ms`);
    await testInfo.attach("catalog-freshness-report", {
      body: Buffer.from(JSON.stringify(report, null, 2)),
      contentType: "application/json",
    });
  } finally {
    if (productId) await admin.query("delete from catalog_private.catalog_products where id = $1", [productId]);
    if (rightsId) await admin.query("delete from catalog_private.product_preview_rights where id = $1", [rightsId]);
    await admin.query("delete from catalog_private.product_preview_configuration");
    for (const row of configuration.rows) {
      await admin.query(`insert into catalog_private.product_preview_configuration
        (environment_name, cloud_name, asset_folder, created_at, updated_at) values ($1, $2, $3, $4, $5)`,
      [row.environment_name, row.cloud_name, row.asset_folder, row.created_at, row.updated_at]);
    }
    await invalidate(request, "catalog_products");
    await admin.end();
  }
});
