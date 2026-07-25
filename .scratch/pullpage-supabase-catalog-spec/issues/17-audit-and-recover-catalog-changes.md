# Audit and recover Catalog changes

Label: ready-for-agent
Type: task
Status: open
Blocked by: 11, 15, 16

## Parent

[Pullpage dynamic Supabase catalog](../spec.md)

## What to build

Make accepted Dashboard changes diagnosable and recoverable from operator mistake through exceptional hard deletion. Every Catalog Product mutation must have transactionally consistent before/after evidence, correlate as far as possible with named Supabase activity, support targeted row correction without unrelated loss, and sit inside tested backup, PITR, independent export, and controlled restore procedures.

## Acceptance criteria

- [ ] A private append-only journal records Catalog Product insert/update/delete operation, stable UUID/slug, UTC timestamp, database role, transaction identifier, and complete old/new row values in the same transaction.
- [ ] Ordinary Dashboard editing and the runtime role cannot update, delete, truncate, or read private journal evidence.
- [ ] Journal trigger/functions and protections are migration-owned and verified after migration.
- [ ] Representative insert, edit, archive, restore, failed save, and controlled delete are correlated with Supabase Team Platform Audit Logs and focused database audit logs without inventing a human actor field the database cannot supply.
- [ ] Shared accounts are prohibited and named MFA accounts plus quarterly access review are documented and evidenced.
- [ ] A mistaken field edit or archive is restored from the exact journal before-image in one reviewed transaction without losing unrelated valid changes.
- [ ] Targeted recovery revalidates the full public projection, invalidates the Catalog generation, and verifies shelf, canonical route, modal, metadata, sitemap, and preview behavior.
- [ ] Production requirements specify Supabase Team, explicitly enabled PITR for at least 14 days, scheduled backups, audit/log retention, and named primary/backup recovery owners.
- [ ] An encrypted logical export process outside the Supabase organization verifies expected schemas, tables, and counts and follows retention of 35 daily, 12 month-end, and at least one year for pre-destructive copies.
- [ ] An isolated restore rehearsal proves schema, constraints, roles/grants, RLS, views, triggers, reference data, Catalog Products, rights data, and journal entries rather than only parsing the dump.
- [ ] A non-production PITR/whole-restore drill freezes edits/migrations, records the UTC target, preserves evidence/current data, requires two-person approval, validates all invariants, replays later valid work, refreshes cache, and smoke-tests before reopening.
- [ ] The runbook distinguishes targeted correction, forward repair, application rollback, PITR, scheduled backup, and independent-export recovery and records their selected RPO/RTO objectives.
- [ ] Routine Catalog Editors cannot hard-delete and use archival for normal removal.
- [ ] Exceptional hard deletion is allowed only for documented legal/privacy/correction need and requires two-person approval, healthy recovery point, verified pre-change export, journal before-image, controlled transaction, cache invalidation, noindex/not-found/sitemap verification, and Cloudinary/rights disposition.
- [ ] Hard-deletion evidence retention and any legally required erasure exception are documented with counsel-defined handling.
- [ ] Recovery and hard-delete tests retain approvers, executor, exact affected stable identity, timestamps, audit/journal evidence, validation results, cache behavior, and public verification.

## Blocked by

- [Ticket 11](11-create-and-edit-valid-catalog-product.md)
- [Ticket 15](15-archive-and-restore-catalog-product.md)
- [Ticket 16](16-keep-catalog-safe-during-database-and-cache-failure.md)
