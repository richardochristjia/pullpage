# Promote the Catalog safely across environments

Label: ready-for-agent
Type: task
Status: open
Blocked by: 10, 11, 16, 17

## Parent

[Pullpage dynamic Supabase catalog](../spec.md)

## What to build

Prove that the complete working Catalog can be reproduced and promoted safely from local development through the persistent synthetic Preview environment to a Production-ready configuration. Deliver isolated credentials and data, immutable reviewed migrations, deterministic non-production fixtures, least-privilege runtime access, protected migration execution, destructive-change safeguards, rollback/repair procedures, and release ownership.

This slice does not enter real Production Catalog Products or bypass launch gates. It makes the implementation deployable and verifiable without depending on manually constructed database state.

## Acceptance criteria

- [ ] Local Supabase, persistent Preview Supabase, and dedicated Production Supabase are defined as isolated environments with distinct project references, credentials, roles, webhook secrets, Cloudinary configuration, backup targets, and Vercel scopes.
- [ ] Preview and Production Supabase are configured for Singapore and catalog-dependent Vercel Node.js runtime is configured for `sin1`, with actual provider identifiers recorded.
- [ ] Untrusted pull requests receive no hosted database credential; trusted Preview uses only Preview runtime access and cannot reach Production.
- [ ] Production Vercel receives only the read-only transaction-pool runtime credential; migration and shadow credentials are absent from build/runtime settings.
- [ ] Runtime, migration, backup, Dashboard, and recovery identities are distinct and use TLS, least privilege, finite timeouts, and individual MFA where applicable.
- [ ] The committed Prisma migration history plus reviewed hand-written SQL reproduces extensions, tables, indexes, checks, functions, triggers, views, RLS, grants, Rarity data, webhooks, and audit journal from an empty database.
- [ ] CI applies the complete history from zero, generates Prisma deterministically, checks migration/schema drift and migration-owned objects behaviorally, runs the synthetic seed, and executes database/module/browser tests.
- [ ] CI also upgrades the prior schema with the 500-product fixture and records lock duration, data counts, public facts, compatibility, and rollback/repair evidence.
- [ ] Prisma schema push, development migration, reset, and database studio workflows are prohibited against Preview and Production; applied migrations and migration history are never edited manually.
- [ ] The local/Preview seed is deterministic, idempotent for owned synthetic IDs, covers all Rarity/format/missing/duplicate/archive/rights/500-product cases, queries generated slugs, and refuses known Production references without an explicit non-production flag.
- [ ] Production automation has no seed step and no Production content or private rights evidence is copied into source control or non-production.
- [ ] A protected single-flight Preview migration job uses direct/session migration access, deploys the matching application commit, and passes schema, role, route, cache, archive, failure, audit, and recovery smoke tests.
- [ ] The Production release procedure freezes Dashboard edits, records exact commit/migrations, verifies current PITR and an independent export, obtains required approval, runs migration status/deploy outside application build, validates invariants, deploys the matching app, and reopens editing only after smoke tests.
- [ ] Destructive SQL and large backfills use expand/backfill/contract, finite lock/statement bounds, tested duration, two-person approval, compatibility window, recovery threshold, and a later contract release.
- [ ] Failure procedures distinguish app rollback, transactional migration retry, partial migration investigation, reviewed forward repair, migration resolution, targeted data recovery, and full restore without rewriting applied history.
- [ ] Named primary/backup Migration, Deployment, Recovery, Dashboard, rights, cache/webhook, Cloudinary, performance, and second-approver roles have tested access and documented escalation.
- [ ] An environment inventory and Preview promotion rehearsal are retained without exposing secret values.

## Blocked by

- [Ticket 10](10-establish-end-to-end-catalog-tracer.md)
- [Ticket 11](11-create-and-edit-valid-catalog-product.md)
- [Ticket 16](16-keep-catalog-safe-during-database-and-cache-failure.md)
- [Ticket 17](17-audit-and-recover-catalog-changes.md)
