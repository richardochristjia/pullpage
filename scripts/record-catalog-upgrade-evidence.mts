import pg from "pg";

const databaseUrl = process.env.LOCAL_MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error("LOCAL_MIGRATION_DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
try {
  const counts = await pool.query<{
    products: number;
    active_products: number;
    inactive_products: number;
  }>(`
    select
      count(*)::int products,
      count(*) filter (where is_active)::int active_products,
      count(*) filter (where not is_active)::int inactive_products
    from catalog_private.catalog_products
  `);
  const facts = await pool.query(`
    select card_name, english_collector_number, japanese_collector_number,
      english_set_name, japanese_set_name, rarity,
      binder_sleeve_price, toploader_price, is_active
    from catalog_private.catalog_products order by slug limit 5
  `);
  const client = await pool.connect();
  let rollbackVerified = false;
  try {
    await client.query("begin");
    const before = await client.query<{ card_name: string | null }>("select card_name from catalog_private.catalog_products where id='10000000-0000-4000-8000-000000000004'");
    await client.query("update catalog_private.catalog_products set card_name='Upgrade rollback probe' where id='10000000-0000-4000-8000-000000000004'");
    await client.query("rollback");
    const after = await client.query<{ card_name: string | null }>("select card_name from catalog_private.catalog_products where id='10000000-0000-4000-8000-000000000004'");
    rollbackVerified = before.rows[0].card_name === after.rows[0].card_name;
  } finally {
    client.release();
  }
  console.log(JSON.stringify({
    recordedAt: new Date().toISOString(),
    upgradeDurationMs: Number(process.env.UPGRADE_DURATION_MS),
    ...counts.rows[0],
    representativeCatalogFacts: facts.rows,
    expectedVisibilityMapping: counts.rows[0].active_products === 480 && counts.rows[0].inactive_products === 21,
    transactionalRollbackVerified: rollbackVerified,
    decision: "docs/adr/0001-use-a-directly-edited-read-only-supabase-catalog.md",
  }, null, 2));
} finally {
  await pool.end();
}
