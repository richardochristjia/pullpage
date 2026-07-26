import "server-only";

import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { cacheLife, cacheTag } from "next/cache";
import { Pool } from "pg";
import { cache } from "react";
import { PrismaClient } from "@/generated/prisma/client";
import {
  createCatalogGeneration,
  InvalidCatalogProjectionError,
  type CatalogGeneration,
  type CatalogProjectionRow,
} from "./catalog-generation";

export type { CatalogFormatOption, PublicCatalogProduct } from "./catalog-generation";

export const CATALOG_CACHE_TAG = "catalog";

export class CatalogUnavailableError extends Error {
  constructor() {
    super("The Catalog is temporarily unavailable");
    this.name = "CatalogUnavailableError";
  }
}

let client: PrismaClient | undefined;
let pool: Pool | undefined;
let clientDatabaseUrl: string | undefined;
let consecutiveRefreshFailures = 0;
const pendingAcquisitions: Array<{ correlationId: string; startedAt: number; durationMs: number | null }> = [];

function configuredMilliseconds(name: string, fallback: number) {
  const configured = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(configured) && configured >= 100 && configured <= 60_000
    ? configured
    : fallback;
}

function catalogPool(databaseUrl: string) {
  const nextPool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: configuredMilliseconds("CATALOG_CONNECTION_TIMEOUT_MS", 5_000),
    statement_timeout: configuredMilliseconds("CATALOG_STATEMENT_TIMEOUT_MS", 10_000),
    query_timeout: configuredMilliseconds("CATALOG_QUERY_TIMEOUT_MS", 10_000),
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
    application_name: "pullpage-catalog",
  });
  nextPool.on("acquire", () => {
    const acquisition = pendingAcquisitions.shift();
    if (acquisition) acquisition.durationMs = Math.round(performance.now() - acquisition.startedAt);
  });
  nextPool.on("error", () => {
    logCatalogEvent("catalog.pool.error", { result: "failure" });
  });
  return nextPool;
}

function getCatalogClient(databaseUrl: string) {
  if (!client) {
    pool = catalogPool(databaseUrl);
    client = new PrismaClient({
      // adapter-pg bundles a second declaration copy for the same runtime pg Pool.
      adapter: new PrismaPg(pool as unknown as ConstructorParameters<typeof PrismaPg>[0]),
    });
    clientDatabaseUrl = databaseUrl;
  }
  if (clientDatabaseUrl !== databaseUrl) {
    throw new Error("The Catalog client is already configured for this process");
  }
  return client;
}

function logCatalogEvent(event: string, details: Record<string, string | number | boolean | null>) {
  console.info(JSON.stringify({
    event,
    occurredAt: new Date().toISOString(),
    ...details,
  }));
}

async function loadCatalogGeneration(databaseUrl: string): Promise<CatalogGeneration> {
  const correlationId = randomUUID();
  const startedAt = performance.now();
  const acquisition = { correlationId, startedAt, durationMs: null as number | null };
  pendingAcquisitions.push(acquisition);
  try {
    const rows = await getCatalogClient(databaseUrl).$queryRaw<CatalogProjectionRow[]>`
      select
        slug,
        card_name,
        collector_number,
        set_name,
        rarity_code,
        rarity_sort_position,
        design_name,
        format_code,
        binder_sleeve_price,
        toploader_price,
        product_preview_url
      from catalog_public.active_catalog_products
      order by slug
    `;
    if (rows.length === 0) {
      logCatalogEvent("catalog.alert.empty_projection", { correlationId, result: "firing" });
    }
    const generation = createCatalogGeneration(rows, new Date());
    const recoveredFromAlert = consecutiveRefreshFailures >= 2;
    consecutiveRefreshFailures = 0;
    logCatalogEvent("catalog.projection.refresh", {
      correlationId,
      generationId: generation.id,
      result: "success",
      cacheState: "refresh",
      projectionDurationMs: Math.round(performance.now() - startedAt),
      acquisitionDurationMs: acquisition.durationMs,
      queryCount: 1,
      productCount: generation.products.length,
      poolTotal: pool?.totalCount ?? 0,
      poolIdle: pool?.idleCount ?? 0,
      poolWaiting: pool?.waitingCount ?? 0,
      poolUtilizationPercent: pool ? Math.round((pool.totalCount - pool.idleCount) * 100) : 0,
    });
    if (recoveredFromAlert) {
      logCatalogEvent("catalog.alert.recovered", {
        correlationId,
        generationId: generation.id,
        result: "resolved",
      });
    }
    return generation;
  } catch (reason) {
    const pendingIndex = pendingAcquisitions.findIndex((candidate) => candidate.correlationId === correlationId);
    if (pendingIndex >= 0) pendingAcquisitions.splice(pendingIndex, 1);
    consecutiveRefreshFailures += 1;
    const duration = Math.round(performance.now() - startedAt);
    logCatalogEvent("catalog.projection.refresh", {
      correlationId,
      result: "failure",
      cacheState: "refresh",
      projectionDurationMs: duration,
      acquisitionDurationMs: acquisition.durationMs,
      queryCount: 1,
      consecutiveFailures: consecutiveRefreshFailures,
      poolTotal: pool?.totalCount ?? 0,
      poolIdle: pool?.idleCount ?? 0,
      poolWaiting: pool?.waitingCount ?? 0,
      poolUtilizationPercent: pool ? Math.round((pool.totalCount - pool.idleCount) * 100) : 0,
      validationFailure: reason instanceof InvalidCatalogProjectionError,
      timeout: duration >= configuredMilliseconds("CATALOG_CONNECTION_TIMEOUT_MS", 5_000),
    });
    if (consecutiveRefreshFailures === 2) {
      logCatalogEvent("catalog.alert.refresh_failures", {
        correlationId,
        result: "firing",
        consecutiveFailures: consecutiveRefreshFailures,
      });
    }
    throw new CatalogUnavailableError();
  }
}

export async function listActiveCatalogProducts(options?: {
  databaseUrl?: string;
}) {
  const databaseUrl = options?.databaseUrl ?? process.env.CATALOG_DATABASE_URL;
  if (!databaseUrl) throw new CatalogUnavailableError();
  return (await loadCatalogGeneration(databaseUrl)).products;
}

async function readLastKnownGoodGeneration(): Promise<CatalogGeneration> {
  "use cache: remote";
  cacheLife({ stale: 30, revalidate: 3_600, expire: 31_536_000 });
  const databaseUrl = process.env.CATALOG_DATABASE_URL;
  if (!databaseUrl) throw new CatalogUnavailableError();
  return loadCatalogGeneration(databaseUrl);
}

async function readCatalogGeneration(): Promise<CatalogGeneration> {
  "use cache: remote";
  cacheLife("catalog");
  cacheTag(CATALOG_CACHE_TAG);
  const databaseUrl = process.env.CATALOG_DATABASE_URL;
  if (!databaseUrl) throw new CatalogUnavailableError();

  try {
    const generation = await loadCatalogGeneration(databaseUrl);
    try {
      await readLastKnownGoodGeneration();
    } catch {
      // A valid current generation is safe to return even if the safety copy could not refresh.
    }
    return generation;
  } catch {
    const generation = await readLastKnownGoodGeneration();
    logCatalogEvent("catalog.generation.fallback", {
      generationId: generation.id,
      result: "last-known-good",
      cacheState: "last-known-good",
      cacheAgeSeconds: Math.max(0, Math.round((Date.now() - Date.parse(generation.generatedAt)) / 1_000)),
    });
    return generation;
  }
}

const getCatalogGeneration = cache(readCatalogGeneration);

export const getCatalog = cache(async () => {
  const generation = await getCatalogGeneration();
  const ageSeconds = Math.max(0, Math.round((Date.now() - Date.parse(generation.generatedAt)) / 1_000));
  logCatalogEvent("catalog.generation.read", {
    generationId: generation.id,
    result: "success",
    cacheState: "available",
    cacheAgeSeconds: ageSeconds,
  });
  if (ageSeconds > 60) {
    logCatalogEvent("catalog.alert.generation_age", {
      generationId: generation.id,
      result: "firing",
      cacheAgeSeconds: ageSeconds,
    });
  }
  return generation.products;
});

export async function getCatalogProduct(
  slug: string,
  options?: { databaseUrl?: string },
) {
  const products = options?.databaseUrl
    ? await listActiveCatalogProducts(options)
    : await getCatalog();
  return products.find((product) => product.slug === slug) ?? null;
}

export function getCatalogRuntimeStatus() {
  return {
    connections: {
      maximum: 1,
      total: pool?.totalCount ?? 0,
      idle: pool?.idleCount ?? 0,
      waiting: pool?.waitingCount ?? 0,
    },
    consecutiveRefreshFailures,
  };
}

export async function closeCatalog() {
  await client?.$disconnect();
  await pool?.end();
  client = undefined;
  pool = undefined;
  clientDatabaseUrl = undefined;
  consecutiveRefreshFailures = 0;
  pendingAcquisitions.length = 0;
}
