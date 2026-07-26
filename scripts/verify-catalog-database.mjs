import dotenv from "dotenv";
import { readCatalogBackupInventory } from "./catalog-backup-inventory.mjs";

dotenv.config({ path: ".env.local", quiet: true });
const databaseUrl = process.env.CATALOG_VERIFY_DATABASE_URL;
if (!databaseUrl) throw new Error("CATALOG_VERIFY_DATABASE_URL is required.");
const inventory = await readCatalogBackupInventory(databaseUrl);
console.info(JSON.stringify({ verifiedAt: new Date().toISOString(), ...inventory }, null, 2));
