# Choose the canonical Pullpage production origin

Type: grilling
Status: resolved
Blocked by: 07

## Question

Which single absolute HTTPS production origin—an owned custom domain or a stable Vercel production domain—must the specification use for metadataBase, canonical product URLs, shared links, robots, and the sitemap?

## Answer

Use **`https://pullpage.vercel.app`** as Pullpage’s single canonical production origin for the initial launch.

The specification must use that exact lowercase, query-free origin—with no trailing slash—for `metadataBase`, catalog and product canonical URLs, copied/shared links, Open Graph URLs, `robots.txt`, and sitemap entries. Vercel preview URLs, branch URLs, and deployment-specific URLs must remain `noindex` and must never appear as canonical or sitemap origins.

Enable production indexing only after `https://pullpage.vercel.app` is assigned to the project, serves the production deployment over HTTPS, and passes canonical/robots/sitemap smoke checks.

An owned custom domain may replace it later, but only as a coordinated canonical-origin migration: update every origin-dependent output together, redirect old canonical paths to their equivalents on the new origin, publish the replacement sitemap, and verify search/social metadata. Until that migration is deliberately completed, `https://pullpage.vercel.app` remains authoritative; the application must not choose an origin dynamically from request or deployment hostnames.
