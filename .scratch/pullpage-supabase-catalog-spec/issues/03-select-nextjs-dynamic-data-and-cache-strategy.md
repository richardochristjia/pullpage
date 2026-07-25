# Select the Next.js dynamic data and cache strategy

Type: research
Status: resolved
Blocked by:

## Question

How should Next.js 16.2.10 query Supabase through Prisma, cache catalog/product results for at most 60 seconds, deduplicate page and metadata reads, handle invalidation and database failure, and retain intercepted product routes without a redeployment-based data snapshot?

## Answer

### Decision

Use a server-only Catalog data-access layer (DAL) that reads the complete public Catalog Product projection through Prisma and returns plain, serializable DTOs. Enable Next.js 16 Cache Components and put that projection behind one shared `"use cache: remote"` entry tagged `catalog`. Derive slug lookups from the cached projection rather than maintaining independently timed list and product caches.

Use a named cache profile with explicit values:

```ts
catalog: {
  stale: 30,
  revalidate: 30,
  expire: 60,
}
```

The 30-second revalidation point leaves headroom inside the 60-second freshness target; the 60-second expiry prevents an inactive cache from being used indefinitely without a blocking refresh. Because an expiry below five minutes is a request-time dynamic hole under Cache Components, render catalog-dependent content inside meaningful `Suspense`/`loading.tsx` boundaries. Use a remote cache because this content is deferred to request time and Vercel serverless instances must share one cache rather than relying on per-instance memory. Confirm during implementation that the selected Vercel deployment supplies the remote cache handler; if it does not, configure a supported shared handler before launch.

This is runtime caching, not a build snapshot. Do not use `unstable_cache`: Next.js 16.2.10 says it has been replaced by `use cache`. Do not use route-level `revalidate`, `force-static`, `output: "export"`, or a periodically redeployed `generateStaticParams` list as the catalog publication mechanism.

A sketch of the intended seam is:

```ts
import "server-only";
import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";

async function readCatalogCached() {
  "use cache: remote";
  cacheLife("catalog");
  cacheTag("catalog");
  return readAndValidatePublicCatalogWithPrisma();
}

export const getCatalog = cache(readCatalogCached);
export const getCatalogProduct = cache(async (slug: string) =>
  (await readCatalogCached()).find((product) => product.slug === slug) ?? null,
);
```

The exact implementation may index the projection by slug after reading it, but the cached return value must remain a plain serializable value, not Prisma model, `Decimal`, or other class instances. At the accepted ceiling of 500 Catalog Products, one coherent projection is small enough and avoids list/detail version skew.

### Deduplication and rendering

- Both `generateMetadata` and the canonical/intercepted product UI call the same exported `getCatalogProduct(slug)`. React `cache()` provides request-scoped memoization for ORM reads when `fetch` is unavailable; the inner Cache Components entry provides cross-request caching. This prevents page and metadata from issuing duplicate Prisma queries on a miss.
- The shelf, product pages, intercepted modal, sitemap, and any other catalog-derived output use the same DAL rather than querying Prisma independently.
- Keep `/products/[slug]` runtime-discoverable. Omit `generateStaticParams` for publication purposes and retain the default runtime handling of new params. Next.js documents that `generateStaticParams` is not called again during ISR, so using it with `dynamicParams = false` would make newly created Catalog Products require a deployment.
- With Cache Components and no `generateStaticParams`, param-dependent content belongs behind `Suspense` or `loading.tsx`. The full product route and `@modal/(.)products/[slug]` intercepted route both render the same detail component. Interception still gives a modal on soft navigation and a complete page on hard navigation; caching does not require changing that route structure.
- A successful lookup returning `null` means unknown or archived and calls `notFound()`. A Prisma/connection/validation exception must propagate to an error boundary and must never be converted to `null`, an empty catalog, or a 404.

### Invalidation

Configure a Supabase Database Webhook for `INSERT`, `UPDATE`, and `DELETE` on the Catalog Product table. Have it send `POST` to a dedicated Next.js Route Handler with a high-entropy bearer secret in a header. The handler validates the secret, accepts only the expected event/table, and calls:

```ts
revalidateTag("catalog", { expire: 0 });
```

Next.js specifically documents `{ expire: 0 }` for external systems that need immediate tag expiry. The next reader then blocks for fresh data, while the 30/60-second time policy remains a safety net if webhook delivery is delayed or missed. One global tag is deliberate: any product mutation can affect the shelf, slug lookup, sitemap, filters, sorting, and duplicate-design presentation together. Dashboard users do not need a custom Pullpage admin or deploy action.

The invalidation endpoint does not accept a caller-supplied tag or path, does not expose database credentials, and logs accepted/rejected delivery without logging the secret. Secret rotation and a manual authenticated invalidation runbook are required recovery controls.

### Database and invalid-data failure

- Validate and transform the entire public projection before returning from the cached function. Throwing prevents a partial or invalid read from becoming the new cached value.
- During failed background revalidation, retain and serve the last successfully generated projection and retry on a later request, matching Next.js ISR failure semantics. Log the failure with a digest/correlation identifier and alert after repeated failures.
- If no last-known-good value exists (cold cache, first deployment, or cache loss), render a branded temporary-unavailable error state with Retry; do not pretend the catalog is empty. Product metadata may use safe generic Pullpage metadata for that error response, but must not emit product facts from a failed read.
- Archiving may remain visible until refresh; during a database outage, last-known-good content may remain visible longer than 60 seconds. Recovery is automatic after the next successful read, with manual tag invalidation available to force a retry.

### Freshness limit clarification

Next.js time-based revalidation is stale-while-revalidate: after `revalidate`, the triggering request can receive stale content while refresh runs. Supabase Database Webhooks are also asynchronous. Therefore “within 60 seconds” is a healthy-operation target, not a mathematical hard upper bound, and retaining last-known-good data during a database outage intentionally exceeds it.

The replacement specification must state that priority explicitly. If the business instead requires that no response ever contain data older than 60 seconds, it must choose blocking reads after the deadline and accept catalog unavailability whenever Supabase cannot be reached; native stale-while-revalidate plus last-known-good behavior cannot satisfy both guarantees simultaneously.

### Acceptance evidence

Implementation handoff must demonstrate in a production-mode deployment:

1. one Prisma query for concurrent page and metadata reads on a cold catalog key;
2. shared cache hits across separate requests/instances;
3. a valid Dashboard insert, update, and archive becoming visible without deployment and normally within 60 seconds;
4. a missed webhook still recovering through time-based revalidation;
5. failed revalidation retaining the last-known-good projection, and cold-cache failure showing temporary-unavailable rather than empty/404;
6. a newly inserted slug working as both a hard-loaded complete page and an intercepted modal soft navigation; and
7. unknown/archived slugs producing the branded noindex 404 after successful refresh.

### Primary sources

- Next.js 16.2.10, [`use cache`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/01-directives/use-cache.mdx): cache keys, serializability, Cache Components, runtime/serverless behavior, and replacement caching model.
- Next.js 16.2.10, [`use cache: remote`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/01-directives/use-cache-remote.mdx): shared remote handlers, serverless behavior, and database-load use case.
- Next.js 16.2.10, [`cacheLife`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/04-functions/cacheLife.mdx): `stale`/`revalidate`/`expire`, client minimum stale time, dynamic holes, and explicit profiles.
- Next.js 16.2.10, [`cacheTag`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/04-functions/cacheTag.mdx) and [`revalidateTag`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/04-functions/revalidateTag.mdx): tag assignment and external webhook invalidation with `{ expire: 0 }`.
- Next.js 16.2.10, [`unstable_cache`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/04-functions/unstable_cache.mdx): replaced by Cache Components in Next.js 16.
- Next.js 16.2.10, [`generateMetadata`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/04-functions/generate-metadata.mdx) and [Fetching Data](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/01-getting-started/06-fetching-data.mdx): React `cache()` for non-`fetch` request deduplication and server-side ORM access.
- Next.js 16.2.10, [dynamic routes](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.mdx), [`generateStaticParams`](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/04-functions/generate-static-params.mdx), [intercepting routes](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/03-file-conventions/intercepting-routes.mdx), and [parallel routes](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/03-api-reference/03-file-conventions/parallel-routes.mdx): runtime params and modal routing behavior.
- Next.js 16.2.10, [ISR](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/02-guides/incremental-static-regeneration.mdx): stale-while-revalidate timing, failed-regeneration retention, and runtime caveats.
- Next.js 16.2.10, [Data Security](https://github.com/vercel/next.js/blob/v16.2.10/docs/01-app/02-guides/data-security.mdx): server-only DALs and minimal DTOs.
- Supabase, [Database Webhooks](https://supabase.com/docs/guides/database/webhooks): asynchronous `INSERT`/`UPDATE`/`DELETE` webhooks built on database triggers and `pg_net`.
- Prisma, [Select fields](https://www.prisma.io/docs/orm/prisma-client/queries/select-fields): selecting only the public projection returned by the DAL.
