export type CatalogEnvironment = {
  projectRef: string;
  supabaseRegion: "local" | "ap-southeast-1";
  vercelScope: string;
  runtimeCredential: string;
  migrationCredential: string;
  webhookSecret: string;
  cloudinaryConfiguration: string;
  backupTarget: string;
  seedAllowed: boolean;
};

export type CatalogEnvironmentInventory = {
  runtimeRegion: string;
  environments: Record<"local" | "preview" | "production", CatalogEnvironment>;
};

function duplicates(values: string[]) {
  return new Set(values).size !== values.length;
}

export function validateCatalogCredential(value: string, identity: "runtime" | "migration" | "backup" | "recovery") {
  const errors: string[] = [];
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Catalog credential must be a valid PostgreSQL URL"); }
  if (!url.searchParams.has("sslmode")) errors.push("TLS sslmode is required");
  if (!url.searchParams.has("connect_timeout")) errors.push("finite connect_timeout is required");
  if (!url.searchParams.has("statement_timeout")) errors.push("finite statement_timeout is required");
  if (identity === "runtime" && (!url.username.startsWith("catalog_runtime") || url.port !== "6543")) errors.push("runtime must use the catalog_runtime transaction-pool identity");
  if (identity === "migration" && (url.username.startsWith("catalog_runtime") || url.port === "6543")) errors.push("migration identity must use direct/session access");
  if (errors.length) throw new Error(errors.join("; "));
  return { valid: true as const };
}

export function assertSyntheticSeedTarget(input: {
  environment: "local" | "preview" | "production";
  databaseUrl: string;
  inventory: CatalogEnvironmentInventory;
}) {
  assertCatalogDatabaseOperation({ operation: "seed", environment: input.environment });
  const url = new URL(input.databaseUrl);
  const productionRef = input.inventory.environments.production.projectRef;
  if (url.username.includes(productionRef)) throw new Error("Synthetic fixtures refuse a known Production project reference");
  if (input.environment === "preview" && !url.username.includes(input.inventory.environments.preview.projectRef)) {
    throw new Error("Preview synthetic fixtures require the inventoried Preview project reference");
  }
  if (input.environment === "local" && !["127.0.0.1", "localhost"].includes(url.hostname)) {
    throw new Error("Local synthetic fixtures require a loopback database");
  }
  return { allowed: true as const };
}

export function assertCatalogDatabaseOperation(input: {
  operation: "reset" | "studio" | "push" | "migration" | "seed";
  environment: "local" | "preview" | "production";
}) {
  if ((input.operation === "reset" || input.operation === "studio") && input.environment !== "local") {
    throw new Error(`${input.operation} is a local only Catalog database operation`);
  }
  if (input.operation === "seed" && input.environment === "production") {
    throw new Error("Production is never seeded");
  }
  return { allowed: true as const };
}

export function validateCatalogEnvironments(inventory: CatalogEnvironmentInventory) {
  const errors: string[] = [];
  const environments = Object.values(inventory.environments);
  const hosted = [inventory.environments.preview, inventory.environments.production];
  if (duplicates(hosted.map((environment) => environment.projectRef))) errors.push("hosted project references must be distinct");
  if (duplicates(hosted.map((environment) => environment.vercelScope))) errors.push("hosted Vercel scopes must be distinct");
  if (duplicates(environments.map((environment) => environment.runtimeCredential))) errors.push("runtime credential names must be distinct");
  if (duplicates(environments.map((environment) => environment.migrationCredential))) errors.push("migration credential names must be distinct");
  if (duplicates(environments.map((environment) => environment.webhookSecret))) errors.push("webhook secret names must be distinct");
  if (duplicates(environments.map((environment) => environment.cloudinaryConfiguration))) errors.push("Cloudinary configurations must be distinct");
  if (duplicates(environments.map((environment) => environment.backupTarget))) errors.push("backup targets must be distinct");
  if (hosted.some((environment) => environment.supabaseRegion !== "ap-southeast-1")) errors.push("hosted Supabase regions must be Singapore");
  if (inventory.runtimeRegion !== "sin1") errors.push("the Vercel Node.js runtime region must be sin1");
  if (inventory.environments.production.seedAllowed) errors.push("Production seeding is prohibited");
  if (errors.length) throw new Error(errors.join("; "));
  return { valid: true as const };
}
