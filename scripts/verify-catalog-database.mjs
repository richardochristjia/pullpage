import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.migration.local", quiet: true });
dotenv.config({ path: ".env.local", quiet: true });
const databaseUrl = process.env.CATALOG_VERIFY_DATABASE_URL ?? process.env.CATALOG_MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error("CATALOG_MIGRATION_DATABASE_URL is required in .env.migration.local (or set CATALOG_VERIFY_DATABASE_URL explicitly).");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
try {
  const tables = await pool.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'catalog_private' and table_type = 'BASE TABLE'
    order by table_name
  `);
  const columns = await pool.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'catalog_private' and table_name = 'catalog_products'
    order by ordinal_position
  `);
  const rarities = await pool.query(`
    select code, display_name, display_order, is_active,
      badge_background_color, badge_foreground_color
    from catalog_private.catalog_rarities order by display_order
  `);
  const counts = await pool.query(`
    select count(*)::integer products,
      count(*) filter (where is_active)::integer active_products,
      count(*) filter (where not is_active)::integer inactive_products
    from catalog_private.catalog_products
  `);
  const runtime = await pool.query(`
    select
      has_table_privilege('catalog_runtime', 'catalog_private.catalog_products', 'SELECT') can_select,
      has_table_privilege('catalog_runtime', 'catalog_private.catalog_products', 'INSERT,UPDATE,DELETE') can_write,
      has_table_privilege('catalog_runtime', 'catalog_private.catalog_rarities', 'SELECT') can_select_rarities,
      has_table_privilege('catalog_runtime', 'catalog_private.catalog_rarities', 'INSERT,UPDATE,DELETE') can_write_rarities,
      exists (
        select 1 from pg_policies
        where schemaname = 'catalog_private'
          and tablename = 'catalog_products'
          and policyname = 'catalog_products_runtime_active_select'
      ) active_policy
  `);
  const bucket = await pool.query(`
    select id, name, public, file_size_limit, allowed_mime_types
    from storage.buckets where id = 'product-previews'
  `);

  const expectedColumns = [
    "id", "slug", "card_name", "collector_number", "set_name", "rarity",
    "design_name", "binder_sleeve_price", "toploader_price", "product_preview_url",
    "created_at", "updated_at", "is_active",
  ];
  const expectedTables = [{ table_name: "catalog_products" }, { table_name: "catalog_rarities" }];
  if (JSON.stringify(tables.rows) !== JSON.stringify(expectedTables) ||
      JSON.stringify(columns.rows.map(({ column_name }) => column_name)) !== JSON.stringify(expectedColumns) ||
      rarities.rows.length !== 21 || rarities.rows.at(-1)?.code !== "NO_MARK" ||
      runtime.rows.length !== 1 || !runtime.rows[0].can_select || runtime.rows[0].can_write ||
      !runtime.rows[0].can_select_rarities || runtime.rows[0].can_write_rarities || !runtime.rows[0].active_policy ||
      bucket.rows.length !== 1 || bucket.rows[0].name !== bucket.rows[0].id || !bucket.rows[0].public || Number(bucket.rows[0].file_size_limit) !== 5_242_880 ||
      JSON.stringify(bucket.rows[0].allowed_mime_types) !== JSON.stringify(["image/jpeg", "image/png", "image/webp"])) {
    throw new Error("The Catalog database contract is incomplete.");
  }

  console.info(JSON.stringify({
    verifiedAt: new Date().toISOString(),
    tables: expectedTables.map(({ table_name }) => `catalog_private.${table_name}`),
    columns: expectedColumns,
    rarities: rarities.rows,
    ...counts.rows[0],
    runtime: runtime.rows[0],
    productPreviewBucket: bucket.rows[0],
  }, null, 2));
} finally {
  await pool.end();
}
