# Use a directly edited, read-only Supabase Catalog

The current Singapore Production Supabase project is the sole hosted Catalog source. Trusted non-developers edit one Catalog Product table and a public Product Preview Storage bucket directly in the Supabase dashboard, while the Next.js application uses Prisma with a dedicated read-only PostgreSQL role whose RLS policy exposes only active products. This deliberately replaces publication, preview-rights, environment-promotion, webhook-invalidation, audit, recovery, and application write workflows with a simpler read-and-display integration.

## Consequences

- A valid row is public by default; `is_active` is only a visibility toggle and an empty active Catalog is valid.
- Existing immutable slugs and URLs remain valid. Supported Binder Formats are derived from positive Binder Sleeve and Toploader prices rather than a separate format code.
- Existing HTTPS Cloudinary previews remain valid, while new previews use a public Supabase Storage bucket restricted to JPEG, PNG, and WebP files up to 5 MB.
- Ordinary server caching may delay edits by up to 60 seconds and may serve its last cached result during an outage; no database webhook is required.
- The hosted Preview and paused Tokyo rollback projects are retired after verification. Disposable local Supabase remains only for schema and mutation tests.
- Direct deletion has no application-level undo, does not delete Storage objects, and may require manual reconstruction. The reduced recovery posture is an accepted trade-off.
