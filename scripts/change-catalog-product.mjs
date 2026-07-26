import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });

const action = process.argv[2];
if (!new Set(["recover", "hard-delete"]).has(action)) {
  throw new Error("Use 'recover' or 'hard-delete'.");
}

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
};

const databaseUrl = required("SUPABASE_ADMIN_DATABASE_URL");
const productId = required("CATALOG_RECOVERY_PRODUCT_ID");
const reason = required("CATALOG_RECOVERY_REASON");
const invalidationOrigin = required("CATALOG_RECOVERY_INVALIDATION_ORIGIN");
const invalidationSecret = required("CATALOG_REVALIDATE_SECRET");
let approvers;
try {
  approvers = JSON.parse(required("CATALOG_RECOVERY_APPROVERS"));
} catch {
  throw new Error("CATALOG_RECOVERY_APPROVERS must be a JSON array of two named approvers.");
}
if (!Array.isArray(approvers)) {
  throw new Error("CATALOG_RECOVERY_APPROVERS must be a JSON array of two named approvers.");
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
let slug;
let committedAt;
try {
  await client.query("begin");
  await client.query("set local role catalog_recovery_operator");
  const identity = await client.query(
    "select slug from catalog_private.catalog_products where id = $1 for update",
    [productId],
  );
  if (identity.rowCount !== 1) throw new Error("The Catalog Product was not found.");
  slug = identity.rows[0].slug;

  if (action === "recover") {
    const journalId = required("CATALOG_RECOVERY_JOURNAL_ID");
    const fields = required("CATALOG_RECOVERY_FIELDS").split(",").map((field) => field.trim()).filter(Boolean);
    await client.query(
      "select catalog_private.recover_catalog_product_fields($1, $2, $3, $4, $5)",
      [productId, journalId, fields, reason, approvers],
    );
  } else {
    await client.query(
      "select catalog_private.hard_delete_catalog_product($1, $2, $3)",
      [productId, reason, approvers],
    );
  }
  committedAt = new Date().toISOString();
  await client.query("commit");
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  if (error instanceof Error && error.message === "The Catalog Product was not found.") throw error;
  throw new Error("The controlled Catalog change was rejected; no change was committed.");
} finally {
  client.release();
  await pool.end();
}

const invalidationUrl = new URL("/api/catalog/invalidate", invalidationOrigin);
const response = await fetch(invalidationUrl, {
  method: "POST",
  headers: {
    authorization: `Bearer ${invalidationSecret}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    type: action === "recover" ? "UPDATE" : "DELETE",
    schema: "catalog_private",
    table: "catalog_products",
    commit_timestamp: committedAt,
  }),
});
if (!response.ok) {
  throw new Error("The database change committed, but Catalog invalidation failed; retry authenticated invalidation before reopening edits.");
}

console.info(JSON.stringify({
  action,
  productId,
  slug,
  committedAt,
  invalidationCorrelationId: response.headers.get("x-correlation-id"),
}));
