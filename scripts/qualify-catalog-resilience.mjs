import { writeFile } from "node:fs/promises";
import process from "node:process";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: ".env.local", quiet: true });
const { Pool } = pg;

const origins = (process.env.CATALOG_QUALIFICATION_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim().replace(/\/$/, ""))
  .filter(Boolean);
const durationSeconds = Number.parseInt(process.env.CATALOG_LOAD_DURATION_SECONDS ?? "600", 10);
const requestsPerSecond = Number.parseInt(process.env.CATALOG_LOAD_REQUESTS_PER_SECOND ?? "50", 10);
const outageDurationSeconds = Number.parseInt(process.env.CATALOG_OUTAGE_DURATION_SECONDS ?? "900", 10);
const output = process.env.CATALOG_QUALIFICATION_OUTPUT ?? "catalog-resilience-qualification.json";
const adminDatabaseUrl = process.env.SUPABASE_ADMIN_DATABASE_URL;
const secret = process.env.CATALOG_REVALIDATE_SECRET;
if (origins.length < 2) throw new Error("CATALOG_QUALIFICATION_ORIGINS must identify at least two warm application instances");
if (!adminDatabaseUrl || !secret) throw new Error("Catalog qualification credentials are required");
if (
  !Number.isInteger(durationSeconds) || durationSeconds < 1 ||
  !Number.isInteger(requestsPerSecond) || requestsPerSecond < 1 ||
  !Number.isInteger(outageDurationSeconds) || outageDurationSeconds < 1
) {
  throw new Error("Catalog qualification settings must be positive integers");
}

const admin = new Pool({ connectionString: adminDatabaseUrl, max: 1 });
const startedAt = new Date();
const latencies = [];
const statuses = new Map();
let product;

async function timedFetch(url, options) {
  const started = performance.now();
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
  latencies.push(Math.round(performance.now() - started));
  statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
  return response;
}

async function invalidate(origin) {
  const response = await timedFetch(`${origin}/api/catalog/invalidate`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
    body: JSON.stringify({ type: "UPDATE", schema: "catalog_private", table: "catalog_products" }),
  });
  if (!response.ok) throw new Error("Catalog invalidation failed during qualification");
  return response.headers.get("x-correlation-id");
}

async function waitForAllInstances(text, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started <= timeoutMs) {
    const bodies = await Promise.all(origins.map(async (origin) => (await timedFetch(`${origin}/`)).text()));
    if (bodies.every((body) => body.includes(text))) return Date.now() - started;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Warm application instances did not converge within 60 seconds");
}

try {
  const selected = await admin.query(`
    select id, slug, card_name from catalog_private.catalog_products
    where archived_at is null order by slug limit 1
  `);
  if (!selected.rows[0]) throw new Error("Qualification requires one active Catalog Product");
  product = selected.rows[0];
  await Promise.all(origins.map((origin) => timedFetch(`${origin}/`)));

  const crossInstanceName = `Cross Instance ${Date.now()}`;
  await admin.query("update catalog_private.catalog_products set card_name = $2 where id = $1", [product.id, crossInstanceName]);
  const crossInstanceCorrelationId = await invalidate(origins[0]);
  const crossInstanceConvergenceMs = await waitForAllInstances(crossInstanceName);

  await admin.query("update catalog_private.catalog_products set card_name = $2 where id = $1", [product.id, product.card_name]);
  await invalidate(origins[0]);
  await waitForAllInstances(product.card_name);

  const outageStartedAt = new Date();
  const outageObservations = [];
  const lockClient = await admin.connect();
  await lockClient.query("begin");
  await lockClient.query("lock table catalog_private.catalog_products in access exclusive mode");
  try {
    while (Date.now() - outageStartedAt.getTime() < outageDurationSeconds * 1_000) {
      const observedAt = new Date();
      const responses = await Promise.all(origins.flatMap((origin) => [
        timedFetch(`${origin}/`),
        timedFetch(`${origin}/products/${product.slug}`),
        timedFetch(`${origin}/sitemap.xml`),
      ]));
      const bodies = await Promise.all(responses.map((response) => response.text()));
      const factsRemainCoherent = origins.every((_, index) =>
        bodies[index * 3].includes(product.card_name) &&
        bodies[index * 3 + 1].includes(product.card_name) &&
        bodies[index * 3 + 2].includes(`/products/${product.slug}`));
      if (responses.some((response) => response.status >= 500) || !factsRemainCoherent) {
        throw new Error("Database outage did not retain one coherent Catalog generation");
      }
      outageObservations.push({
        observedAt: observedAt.toISOString(),
        statuses: responses.map((response) => response.status),
      });
      await new Promise((resolve) => setTimeout(resolve, 30_000));
    }
  } finally {
    await lockClient.query("rollback");
    lockClient.release();
  }
  const recoveryCorrelationId = await invalidate(origins[0]);
  const recoveryConvergenceMs = await waitForAllInstances(product.card_name);

  const endpoints = ["/", `/products/${product.slug}`, "/sitemap.xml"];
  const loadStarted = Date.now();
  let sequence = 0;
  while (Date.now() - loadStarted < durationSeconds * 1_000) {
    const tick = Date.now();
    await Promise.all(Array.from({ length: requestsPerSecond }, (_, index) => {
      const origin = origins[(sequence + index) % origins.length];
      const endpoint = endpoints[(sequence + index) % endpoints.length];
      return timedFetch(`${origin}${endpoint}`);
    }));
    sequence += requestsPerSecond;
    const remaining = 1_000 - (Date.now() - tick);
    if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  const burstCorrelationId = await invalidate(origins[0]);
  const burst = await Promise.all(Array.from({ length: 100 }, (_, index) => {
    const origin = origins[index % origins.length];
    return timedFetch(`${origin}${endpoints[index % endpoints.length]}`);
  }));
  if (burst.some((response) => response.status >= 500)) throw new Error("Post-invalidation burst produced a 5xx");
  if ([...statuses].some(([status]) => status >= 500)) throw new Error("Load qualification produced a 5xx");

  const ordered = [...latencies].sort((a, b) => a - b);
  const percentile = (value) => ordered[Math.ceil(ordered.length * value) - 1];
  const report = {
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    origins: origins.map((_, index) => `instance-${index + 1}`),
    crossInstanceCorrelationId,
    crossInstanceConvergenceMs,
    outageDurationSeconds,
    outageStartedAt: outageStartedAt.toISOString(),
    outageObservations,
    recoveryCorrelationId,
    recoveryConvergenceMs,
    burstCorrelationId,
    durationSeconds,
    targetRequestsPerSecond: requestsPerSecond,
    requestCount: latencies.length,
    statuses: Object.fromEntries(statuses),
    latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), maximum: ordered.at(-1) },
    burstRequests: burst.length,
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  console.info(`Catalog resilience qualification passed; evidence written to ${output}`);
} finally {
  if (product) {
    await admin.query("update catalog_private.catalog_products set card_name = $2 where id = $1", [product.id, product.card_name]);
    await Promise.allSettled(origins.map((origin) => invalidate(origin)));
  }
  await admin.end();
}
