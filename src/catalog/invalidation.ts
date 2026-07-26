import "server-only";

import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { CATALOG_CACHE_TAG } from "./catalog";

function secretsMatch(actual: string | null, expected: string) {
  if (!actual?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(actual.slice(7));
  const configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured);
}

const INVALIDATING_CATALOG_TABLES = new Set([
  "catalog_products",
  "product_preview_rights",
  "product_preview_configuration",
]);

function isExpectedCatalogEvent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if ("tag" in event || "path" in event) return false;
  return (
    (event.type === "INSERT" || event.type === "UPDATE" || event.type === "DELETE") &&
    event.schema === "catalog_private" &&
    typeof event.table === "string" &&
    INVALIDATING_CATALOG_TABLES.has(event.table)
  );
}

export async function invalidateCatalog(request: Request) {
  const secret = process.env.CATALOG_REVALIDATE_SECRET;
  if (!secret) {
    return Response.json({ error: "Catalog invalidation is unavailable" }, { status: 503 });
  }
  if (!secretsMatch(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event: unknown;
  try {
    event = await request.json();
  } catch {
    return Response.json({ error: "Malformed event" }, { status: 400 });
  }
  if (!isExpectedCatalogEvent(event)) {
    return Response.json({ error: "Unexpected event" }, { status: 400 });
  }

  revalidateTag(CATALOG_CACHE_TAG, { expire: 0 });
  console.info("Accepted Catalog cache invalidation event");
  return Response.json({ revalidated: true });
}
