import pg from "pg";

const databaseUrl = process.env.LOCAL_MIGRATION_DATABASE_URL;
if (!databaseUrl) throw new Error("LOCAL_MIGRATION_DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
try {
  const counts = await pool.query<{
    products: number;
    active_products: number;
    archived_products: number;
    journal_entries: number;
  }>(`
    select
      (select count(*)::int from catalog_private.catalog_products) products,
      (select count(*)::int from catalog_public.active_catalog_products) active_products,
      (select count(*)::int from catalog_private.catalog_products where archived_at is not null) archived_products,
      (select count(*)::int from catalog_private.catalog_product_journal) journal_entries
  `);
  const facts = await pool.query(`
    select card_name, collector_number, set_name, rarity_code, format_code
    from catalog_public.active_catalog_products order by slug limit 5
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
    representativePublicFacts: facts.rows,
    priorApplicationCompatibility: counts.rows[0].active_products === 480,
    transactionalRollbackVerified: rollbackVerified,
    forwardRepairProcedure: "docs/catalog-promotion-runbook.md#failure-and-repair",
  }, null, 2));
} finally {
  await pool.end();
}
