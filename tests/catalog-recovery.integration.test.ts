import dotenv from "dotenv";
import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

dotenv.config({ path: ".env.local", quiet: true });
const adminDatabaseUrl = process.env.SUPABASE_ADMIN_DATABASE_URL;
const runtimeDatabaseUrl = process.env.TEST_CATALOG_DATABASE_URL;
const integration = adminDatabaseUrl && runtimeDatabaseUrl ? describe : describe.skip;

async function inRollbackTransaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  await client.query("begin");
  try {
    return await operation(client);
  } finally {
    await client.query("rollback");
    client.release();
  }
}

integration("Catalog recovery database seam", () => {
  let admin: Pool;

  beforeAll(() => {
    admin = new Pool({ connectionString: adminDatabaseUrl });
  });

  afterAll(async () => {
    await admin?.end();
  });

  test("journals committed mutation shapes atomically and omits failed saves", async () => {
    await inRollbackTransaction(admin, async (client) => {
      const inserted = await client.query<{ id: string; slug: string }>(`
        insert into catalog_private.catalog_products
          (card_name, collector_number, format_code, binder_sleeve_price)
        values ('Journal Test', 'audit-${Date.now()}', 'BS', 91000)
        returning id, slug
      `);
      const product = inserted.rows[0];
      await client.query(
        "update catalog_private.catalog_products set card_name = 'Journal Test Edited' where id = $1",
        [product.id],
      );
      await client.query("savepoint before_failed_save");
      await expect(client.query(
        "update catalog_private.catalog_products set format_code = 'ALL', toploader_price = null where id = $1",
        [product.id],
      )).rejects.toMatchObject({ constraint: "catalog_product_toploader_price_required" });
      await client.query("rollback to savepoint before_failed_save");

      const evidence = await client.query<{
        operation: string;
        product_id: string;
        product_slug: string;
        database_role: string;
        transaction_id: string;
        old_row: Record<string, unknown> | null;
        new_row: Record<string, unknown> | null;
      }>(`
        select operation, product_id, product_slug, database_role, transaction_id, old_row, new_row
        from catalog_private.catalog_product_journal_for_product($1)
        order by journal_id
      `, [product.id]);

      expect(evidence.rows.map(({ operation }) => operation)).toEqual(["INSERT", "UPDATE"]);
      expect(evidence.rows[0]).toMatchObject({
        product_id: product.id,
        product_slug: product.slug,
        database_role: expect.any(String),
        transaction_id: expect.stringMatching(/^\d+$/),
        old_row: null,
        new_row: { id: product.id, slug: product.slug, card_name: "Journal Test" },
      });
      expect(evidence.rows[1]).toMatchObject({
        old_row: { card_name: "Journal Test" },
        new_row: { card_name: "Journal Test Edited" },
      });
      expect(evidence.rows[1].transaction_id).toBe(evidence.rows[0].transaction_id);
    });
  });

  test("records archive and restore as separate complete updates for the same stable identity", async () => {
    await inRollbackTransaction(admin, async (client) => {
      const inserted = await client.query<{ id: string; slug: string }>(`
        insert into catalog_private.catalog_products
          (card_name, collector_number, format_code, binder_sleeve_price)
        values ('Journal Lifecycle', 'lifecycle-${Date.now()}', 'BS', 93000)
        returning id, slug
      `);
      const product = inserted.rows[0];
      await client.query("update catalog_private.catalog_products set archived_at = statement_timestamp() where id = $1", [product.id]);
      await client.query("update catalog_private.catalog_products set archived_at = null where id = $1", [product.id]);
      const evidence = await client.query<{ operation: string; product_slug: string; old_row: Record<string, unknown>; new_row: Record<string, unknown> }>(`
        select operation, product_slug, old_row, new_row
        from catalog_private.catalog_product_journal_for_product($1)
        order by journal_id
      `, [product.id]);
      expect(evidence.rows.map(({ operation }) => operation)).toEqual(["INSERT", "UPDATE", "UPDATE"]);
      expect(evidence.rows[1]).toMatchObject({
        product_slug: product.slug,
        old_row: { id: product.id, archived_at: null },
        new_row: { id: product.id, archived_at: expect.any(String) },
      });
      expect(evidence.rows[2]).toMatchObject({
        product_slug: product.slug,
        old_row: { id: product.id, archived_at: expect.any(String) },
        new_row: { id: product.id, archived_at: null },
      });
    });
  });

  test("lets a reviewed recovery restore selected before-image fields without losing later valid work", async () => {
    await inRollbackTransaction(admin, async (client) => {
      const inserted = await client.query<{ id: string }>(`
        insert into catalog_private.catalog_products
          (card_name, collector_number, set_name, format_code, binder_sleeve_price)
        values ('Recovery Original', 'recover-${Date.now()}', 'Original Set', 'BS', 95000)
        returning id
      `);
      const productId = inserted.rows[0].id;
      await client.query("update catalog_private.catalog_products set card_name = 'Mistaken Name' where id = $1", [productId]);
      const mistake = await client.query<{ journal_id: string }>(`
        select journal_id from catalog_private.catalog_product_journal_for_product($1)
        where operation = 'UPDATE' order by journal_id desc limit 1
      `, [productId]);
      await client.query("update catalog_private.catalog_products set set_name = 'Later Valid Set' where id = $1", [productId]);

      await client.query("set local role catalog_recovery_operator");
      await client.query(
        "select catalog_private.recover_catalog_product_fields($1, $2, $3, $4, $5)",
        [productId, mistake.rows[0].journal_id, ["card_name"], "Correct mistaken Card Name", ["Primary Owner", "Backup Owner"]],
      );
      await client.query("reset role");

      const recovered = await client.query<{ card_name: string; set_name: string }>(
        "select card_name, set_name from catalog_private.catalog_products where id = $1",
        [productId],
      );
      expect(recovered.rows[0]).toEqual({ card_name: "Recovery Original", set_name: "Later Valid Set" });
      const recoveryEvidence = await client.query<{ change_reason: string; approved_by: string[]; old_row: Record<string, unknown>; new_row: Record<string, unknown> }>(`
        select change_reason, approved_by, old_row, new_row
        from catalog_private.catalog_product_journal_for_product($1)
        where change_reason is not null order by journal_id desc limit 1
      `, [productId]);
      expect(recoveryEvidence.rows[0]).toMatchObject({
        change_reason: "Correct mistaken Card Name",
        approved_by: ["Primary Owner", "Backup Owner"],
        old_row: { card_name: "Mistaken Name", set_name: "Later Valid Set" },
        new_row: { card_name: "Recovery Original", set_name: "Later Valid Set" },
      });
    });
  });

  test("installs the migration-owned journal trigger and least-privilege recovery roles", async () => {
    const objects = await admin.query<{
      trigger_owner: string;
      journal_owner: string;
      editor_can_read: boolean;
      runtime_can_read: boolean;
      recovery_can_read: boolean;
      recovery_can_mutate: boolean;
    }>(`
      select
        pg_get_userbyid(p.proowner) trigger_owner,
        pg_get_userbyid(c.relowner) journal_owner,
        has_table_privilege('catalog_editor', c.oid, 'SELECT') editor_can_read,
        has_table_privilege('catalog_runtime', c.oid, 'SELECT') runtime_can_read,
        has_table_privilege('catalog_recovery_operator', c.oid, 'SELECT') recovery_can_read,
        has_table_privilege('catalog_recovery_operator', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE') recovery_can_mutate
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_class c on c.oid = 'catalog_private.catalog_product_journal'::regclass
      where n.nspname = 'catalog_private' and p.proname = 'journal_catalog_product_change'
    `);
    expect(objects.rows).toEqual([{
      trigger_owner: "catalog_audit_owner",
      journal_owner: "catalog_audit_owner",
      editor_can_read: false,
      runtime_can_read: false,
      recovery_can_read: true,
      recovery_can_mutate: false,
    }]);
    const trigger = await admin.query(`
      select 1 from pg_trigger
      where tgrelid = 'catalog_private.catalog_products'::regclass
        and tgname = 'catalog_product_90_journal' and tgenabled = 'O'
    `);
    expect(trigger.rowCount).toBe(1);
  });

  test("owns fixed-scope invalidation triggers for every Catalog projection input", async () => {
    const triggers = await admin.query<{ table_name: string; trigger_name: string }>(`
      select c.relname table_name, t.tgname trigger_name
      from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='catalog_private' and t.tgname in (
        'catalog_product_99_invalidate', 'product_preview_rights_99_invalidate',
        'product_preview_configuration_99_invalidate'
      ) order by c.relname
    `);
    expect(triggers.rows).toEqual([
      { table_name: "catalog_products", trigger_name: "catalog_product_99_invalidate" },
      { table_name: "product_preview_configuration", trigger_name: "product_preview_configuration_99_invalidate" },
      { table_name: "product_preview_rights", trigger_name: "product_preview_rights_99_invalidate" },
    ]);
    const owner = await admin.query<{ owner: string }>(`
      select pg_get_userbyid(proowner) owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='catalog_private' and p.proname='enqueue_catalog_invalidation'
    `);
    expect(owner.rows).toEqual([{ owner: "postgres" }]);
  });

  test("restricts journal evidence and hard deletion while controlled deletion retains its before-image", async () => {
    await inRollbackTransaction(admin, async (client) => {
      const inserted = await client.query<{ id: string; slug: string }>(`
        insert into catalog_private.catalog_products
          (card_name, collector_number, format_code, binder_sleeve_price, archived_at)
        values ('Controlled Delete', 'delete-${Date.now()}', 'BS', 99000, statement_timestamp())
        returning id, slug
      `);
      const product = inserted.rows[0];

      await client.query("set local role catalog_editor");
      await client.query("savepoint before_journal_read");
      await expect(client.query("select * from catalog_private.catalog_product_journal limit 1")).rejects.toThrow(/permission denied/i);
      await client.query("rollback to savepoint before_journal_read");
      await client.query("savepoint before_direct_delete");
      await expect(client.query("delete from catalog_private.catalog_products where id = $1", [product.id])).rejects.toThrow(/permission denied/i);
      await client.query("rollback to savepoint before_direct_delete");
      await client.query("reset role");

      await client.query("set local role catalog_recovery_operator");
      await client.query(
        "select catalog_private.hard_delete_catalog_product($1, $2, $3)",
        [product.id, "Documented correction need", ["Primary Owner", "Backup Owner"]],
      );
      await client.query("reset role");
      const deleted = await client.query<{ operation: string; product_slug: string; old_row: Record<string, unknown>; new_row: null; change_reason: string }>(`
        select operation, product_slug, old_row, new_row, change_reason
        from catalog_private.catalog_product_journal_for_product($1)
        order by journal_id desc limit 1
      `, [product.id]);
      await client.query("set local role catalog_recovery_operator");
      await client.query("savepoint before_journal_tamper");
      await expect(client.query(
        "update catalog_private.catalog_product_journal set change_reason = 'tampered' where product_id = $1",
        [product.id],
      )).rejects.toThrow(/permission denied/i);
      await client.query("rollback to savepoint before_journal_tamper");
      await client.query("reset role");
      expect(deleted.rows[0]).toMatchObject({
        operation: "DELETE",
        product_slug: product.slug,
        old_row: { id: product.id, slug: product.slug, card_name: "Controlled Delete" },
        new_row: null,
        change_reason: "Documented correction need",
      });
      expect((await client.query("select 1 from catalog_private.catalog_products where id = $1", [product.id])).rowCount).toBe(0);
    });

    const runtime = new Pool({ connectionString: runtimeDatabaseUrl });
    try {
      await expect(runtime.query("select * from catalog_private.catalog_product_journal limit 1")).rejects.toThrow(/permission denied/i);
    } finally {
      await runtime.end();
    }
  });
});
