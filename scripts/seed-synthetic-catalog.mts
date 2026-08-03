import dotenv from "dotenv";
import pg from "pg";
import { buildSyntheticCatalogFixtures } from "../src/catalog/synthetic-fixtures.ts";

dotenv.config({ path: ".env.local", quiet: true });
const databaseUrl = process.env.LOCAL_MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error("LOCAL_MIGRATION_DATABASE_URL is required for synthetic fixtures");
const seedUrl = new URL(databaseUrl);
if (seedUrl.protocol !== "postgresql:" || !new Set(["127.0.0.1", "localhost", "[::1]", "::1"]).has(seedUrl.hostname)) {
  throw new Error("Synthetic fixtures require a disposable loopback PostgreSQL database");
}

const fixtures = buildSyntheticCatalogFixtures();
const legacyPreviewConfiguration = {
  environmentName: "synthetic",
  cloudName: "pullpage-synthetic",
  assetFolder: "catalog-products/",
};
const legacyPreviewRights = {
  id: "20000000-0000-4000-8000-000000000001",
  exactVersionedUrl: "https://res.cloudinary.com/pullpage-synthetic/image/upload/v1/catalog-products/synthetic-preview.webp",
};
const legacyFormat = (product: (typeof fixtures.products)[number]) =>
  product.binderSleevePrice && product.toploaderPrice ? "ALL" : product.binderSleevePrice ? "BS" : "TL";
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
const client = await pool.connect();
try {
  await client.query("begin");
  await client.query("set local lock_timeout = '5s'; set local statement_timeout = '60s'");
  const schema = await client.query<{ simplified: boolean }>(`
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'catalog_private'
        and table_name = 'catalog_products'
        and column_name = 'is_active'
    ) simplified
  `);

  if (schema.rows[0].simplified) {
    const columnsPerProduct = 11;
    const values: unknown[] = [];
    const tuples = fixtures.products.map((product, productIndex) => {
      const base = productIndex * columnsPerProduct;
      values.push(
        product.id,
        "",
        product.cardName,
        product.collectorNumber,
        product.setName,
        product.rarity,
        product.designName,
        product.binderSleevePrice,
        product.toploaderPrice,
        product.productPreviewUrl,
        product.isActive,
      );
      return `(${Array.from({ length: columnsPerProduct }, (_, column) => `$${base + column + 1}`).join(",")})`;
    });
    await client.query(`
      insert into catalog_private.catalog_products (
        id, slug, card_name, collector_number, set_name, rarity, design_name,
        binder_sleeve_price, toploader_price, product_preview_url, is_active
      ) values ${tuples.join(",")}
      on conflict (id) do update set
        card_name=excluded.card_name, collector_number=excluded.collector_number,
        set_name=excluded.set_name, rarity=excluded.rarity, design_name=excluded.design_name,
        binder_sleeve_price=excluded.binder_sleeve_price,
        toploader_price=excluded.toploader_price,
        product_preview_url=excluded.product_preview_url, is_active=excluded.is_active
      where (catalog_products.card_name, catalog_products.collector_number,
        catalog_products.set_name, catalog_products.rarity, catalog_products.design_name,
        catalog_products.binder_sleeve_price, catalog_products.toploader_price,
        catalog_products.product_preview_url, catalog_products.is_active)
      is distinct from (excluded.card_name, excluded.collector_number, excluded.set_name,
        excluded.rarity, excluded.design_name, excluded.binder_sleeve_price,
        excluded.toploader_price, excluded.product_preview_url, excluded.is_active)
    `, values);
  } else {
    await client.query(`
    insert into catalog_private.product_preview_configuration (singleton, environment_name, cloud_name, asset_folder)
    values (true, $1, $2, $3)
    on conflict (singleton) do update set environment_name=excluded.environment_name, cloud_name=excluded.cloud_name, asset_folder=excluded.asset_folder, updated_at=statement_timestamp()
    where (product_preview_configuration.environment_name, product_preview_configuration.cloud_name, product_preview_configuration.asset_folder)
      is distinct from (excluded.environment_name, excluded.cloud_name, excluded.asset_folder)
  `, [legacyPreviewConfiguration.environmentName, legacyPreviewConfiguration.cloudName, legacyPreviewConfiguration.assetFolder]);
  const rights = legacyPreviewRights;
  await client.query(`
    insert into catalog_private.product_preview_rights (
      id, exact_versioned_url, asset_identifier, source, creator_photographer, owner_licensor,
      permission_basis, permission_evidence, channels, territories, attribution_required,
      effective_on, status, reviewer, reviewed_at
    ) values ($1,$2,'synthetic-preview','Generated fixture','Pullpage fixture generator','Pullpage fixture generator',
      'Synthetic non-production fixture','No private evidence; generated test fixture',array['preview'],array['test'],false,
      date '2026-01-01','approved','Synthetic fixture generator',timestamptz '2026-01-01 00:00:00+00')
    on conflict (id) do update set
      exact_versioned_url=excluded.exact_versioned_url, asset_identifier=excluded.asset_identifier,
      source=excluded.source, creator_photographer=excluded.creator_photographer, owner_licensor=excluded.owner_licensor,
      permission_basis=excluded.permission_basis, permission_evidence=excluded.permission_evidence,
      channels=excluded.channels, territories=excluded.territories, attribution_required=excluded.attribution_required,
      effective_on=excluded.effective_on, status=excluded.status, reviewer=excluded.reviewer, reviewed_at=excluded.reviewed_at
    where (product_preview_rights.exact_versioned_url, product_preview_rights.asset_identifier,
      product_preview_rights.source, product_preview_rights.creator_photographer, product_preview_rights.owner_licensor,
      product_preview_rights.permission_basis, product_preview_rights.permission_evidence, product_preview_rights.channels,
      product_preview_rights.territories, product_preview_rights.attribution_required, product_preview_rights.effective_on,
      product_preview_rights.status, product_preview_rights.reviewer, product_preview_rights.reviewed_at)
    is distinct from (excluded.exact_versioned_url, excluded.asset_identifier, excluded.source,
      excluded.creator_photographer, excluded.owner_licensor, excluded.permission_basis, excluded.permission_evidence,
      excluded.channels, excluded.territories, excluded.attribution_required, excluded.effective_on, excluded.status,
      excluded.reviewer, excluded.reviewed_at)
  `, [rights.id, rights.exactVersionedUrl]);

  const columnsPerProduct = 13;
  const values: unknown[] = [];
  const tuples = fixtures.products.map((product, productIndex) => {
    const base = productIndex * columnsPerProduct;
    values.push(product.id, "", product.cardName, product.collectorNumber, product.setName, product.rarity,
      product.designName, legacyFormat(product), product.binderSleevePrice, product.toploaderPrice,
      product.productPreviewUrl, product.productPreviewUrl ? legacyPreviewRights.id : null,
      product.isActive ? null : "2026-01-01T00:00:00.000Z");
    return `(${Array.from({ length: columnsPerProduct }, (_, column) => `$${base + column + 1}`).join(",")})`;
  });
  await client.query(`
    insert into catalog_private.catalog_products (
      id, slug, card_name, collector_number, set_name, rarity_code, design_name, format_code,
      binder_sleeve_price, toploader_price, product_preview_url, product_preview_rights_id, archived_at
    ) values ${tuples.join(",")}
    on conflict (id) do update set
      card_name=excluded.card_name, collector_number=excluded.collector_number, set_name=excluded.set_name,
      rarity_code=excluded.rarity_code, design_name=excluded.design_name, format_code=excluded.format_code,
      binder_sleeve_price=excluded.binder_sleeve_price, toploader_price=excluded.toploader_price,
      product_preview_url=excluded.product_preview_url, product_preview_rights_id=excluded.product_preview_rights_id,
      archived_at=excluded.archived_at
    where (catalog_products.card_name, catalog_products.collector_number, catalog_products.set_name,
      catalog_products.rarity_code, catalog_products.design_name, catalog_products.format_code,
      catalog_products.binder_sleeve_price, catalog_products.toploader_price, catalog_products.product_preview_url,
      catalog_products.product_preview_rights_id, catalog_products.archived_at)
    is distinct from (excluded.card_name, excluded.collector_number, excluded.set_name, excluded.rarity_code,
      excluded.design_name, excluded.format_code, excluded.binder_sleeve_price, excluded.toploader_price,
      excluded.product_preview_url, excluded.product_preview_rights_id, excluded.archived_at)
    `, values);
  }
  const result = await client.query<{ id: string; slug: string }>(`
    select id, slug from catalog_private.catalog_products
    where id = any($1::uuid[]) order by id
  `, [fixtures.products.map((product) => product.id)]);
  if (result.rowCount !== fixtures.products.length || result.rows.some((row) => !row.slug)) throw new Error("Synthetic Catalog did not produce every generated slug");
  await client.query("commit");
  console.log(JSON.stringify({ environment: "local", productCount: result.rowCount, generatedSlugsVerified: true }));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
