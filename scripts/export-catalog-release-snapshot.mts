import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import pg from "pg";
import { readCatalogBackupInventory } from "./catalog-backup-inventory.mjs";

const databaseUrl = process.env.CATALOG_RELEASE_EXPORT_DATABASE_URL;
const outputPath = process.env.CATALOG_RELEASE_EXPORT_PATH;
const keyPath = process.env.CATALOG_RELEASE_KEY_PATH;
if (!databaseUrl || !outputPath || !keyPath || outputPath === keyPath) throw new Error("Distinct release export, key, and database settings are required");
const tables = ["catalog_rarities", "product_preview_configuration", "product_preview_rights", "catalog_products", "catalog_product_journal"];
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 10_000 });
try {
  const inventory = await readCatalogBackupInventory(databaseUrl);
  const rows: Record<string, unknown[]> = {};
  for (const table of tables) rows[table] = (await pool.query(`select * from catalog_private.${table} order by 1`)).rows;
  const payload = Buffer.from(JSON.stringify({ format: "pullpage-catalog-release-v1", exportedAt: new Date().toISOString(), inventory, rows }));
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  const tag = cipher.getAuthTag();
  const encrypted = Buffer.concat([Buffer.from("PULLPAGE1"), iv, tag, ciphertext]);
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(keyPath), { recursive: true });
  await writeFile(outputPath, encrypted, { mode: 0o600, flag: "wx" });
  await writeFile(keyPath, key.toString("base64"), { mode: 0o600, flag: "wx" });

  const saved = await readFile(outputPath);
  const savedKey = Buffer.from(await readFile(keyPath, "utf8"), "base64");
  const decipher = createDecipheriv("aes-256-gcm", savedKey, saved.subarray(9, 21));
  decipher.setAuthTag(saved.subarray(21, 37));
  const verified = Buffer.concat([decipher.update(saved.subarray(37)), decipher.final()]);
  if (createHash("sha256").update(verified).digest("hex") !== createHash("sha256").update(payload).digest("hex")) throw new Error("Encrypted release export verification failed");
  console.log(JSON.stringify({ encrypted: true, verified: true, tables: tables.length, counts: inventory.counts }));
} finally {
  await pool.end();
}
