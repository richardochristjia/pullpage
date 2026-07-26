import pg from "pg";

export async function readCatalogBackupInventory(databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const tables = await pool.query(`
      select table_name
      from information_schema.tables
      where table_schema = 'catalog_private' and table_type = 'BASE TABLE'
      order by table_name
    `);
    const views = await pool.query(`
      select table_name
      from information_schema.views
      where table_schema = 'catalog_public'
      order by table_name
    `);
    const triggers = await pool.query(`
      select distinct trigger_name
      from information_schema.triggers
      where event_object_schema = 'catalog_private'
      order by trigger_name
    `);
    const roles = await pool.query(`
      select rolname from pg_roles
      where rolname in ('catalog_runtime', 'catalog_editor', 'catalog_recovery_operator', 'catalog_audit_owner')
      order by rolname
    `);
    const counts = {};
    for (const table of tables.rows.map(({ table_name }) => table_name)) {
      if (!/^[a-z_]+$/.test(table)) throw new Error("Unexpected Catalog table name.");
      const result = await pool.query(`select count(*)::integer count from catalog_private.${table}`);
      counts[`catalog_private.${table}`] = result.rows[0].count;
    }

    const inventory = {
      schemas: ["catalog_private", "catalog_public"],
      tables: tables.rows.map(({ table_name }) => `catalog_private.${table_name}`),
      views: views.rows.map(({ table_name }) => `catalog_public.${table_name}`),
      triggers: triggers.rows.map(({ trigger_name }) => trigger_name),
      roles: roles.rows.map(({ rolname }) => rolname),
      counts,
    };
    const required = [
      "catalog_private.catalog_products",
      "catalog_private.catalog_rarities",
      "catalog_private.product_preview_configuration",
      "catalog_private.product_preview_rights",
      "catalog_private.catalog_product_journal",
    ];
    if (required.some((name) => !inventory.tables.includes(name))) {
      throw new Error("The Catalog database inventory is incomplete.");
    }
    if (!inventory.views.includes("catalog_public.active_catalog_products") ||
        !inventory.views.includes("catalog_public.catalog_rarities") ||
        !inventory.triggers.includes("catalog_product_90_journal") ||
        inventory.roles.length !== 4) {
      throw new Error("The Catalog recovery objects are incomplete.");
    }
    return inventory;
  } finally {
    await pool.end();
  }
}
