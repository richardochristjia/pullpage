# Catalog audit and recovery runbook

## Scope and ownership

This free-plan procedure protects Catalog Product changes with a transactional database journal and independent encrypted exports. Supabase Team Platform Audit Logs, provider PITR, paid scheduled backups, and paid provider retention are deferred until advanced operations are needed.

- **Primary recovery owner:** Richard O. Christjia (repository and Supabase project owner)
- **Backup recovery owner:** must be named before the first Production recovery or destructive operation
- **Routine Catalog Editor:** uses the `catalog_editor` database role and cannot read or alter journal evidence or hard-delete Catalog Products
- **Recovery executor:** elevates explicitly to `catalog_recovery_operator` only inside the controlled scripts

Shared provider accounts are prohibited. Every person uses a named Supabase account with MFA. The primary owner records a quarterly review of Supabase members, MFA status, database-role access, departed-user removal, recovery-owner coverage, review UTC time, and reviewer. Free-plan Supabase project owners remain privileged administrators and are never treated as routine Catalog Editors.

## Transactional journal

Migration-owned trigger `catalog_product_90_journal` appends one private `catalog_private.catalog_product_journal` row after every successful Catalog Product insert, update, or delete in the same transaction. Each entry contains:

- operation, stable UUID and immutable slug;
- UTC transaction timestamp, database role, and PostgreSQL transaction identifier;
- complete old and new database rows, with the inapplicable side null;
- controlled recovery reason and two named approvers when a recovery or hard deletion uses the provided functions.

A rejected statement or rolled-back transaction leaves no journal entry. `catalog_runtime` and `catalog_editor` cannot read the journal. `catalog_recovery_operator` can read but cannot insert, update, delete, or truncate it. The Supabase database role is evidence of database execution, not a human identity; never invent a human actor from it. Correlate transaction ID and UTC time to the named external change/recovery record and, if a Team plan is adopted, Platform Audit Logs.

## Recovery choice and objectives

| Situation | Method | Selected RPO | Selected RTO |
| --- | --- | ---: | ---: |
| One mistaken field edit or archive | Targeted journal before-image correction | Zero committed Catalog mutations | 60 minutes |
| Invalid schema/data logic with known correction | Forward migration/repair | Zero after incident freeze | 4 hours |
| Defective application release, sound data | Application rollback | No database recovery | 30 minutes |
| Lost/corrupt hosted database on free plan | Independent encrypted export | 24 hours | 8 hours after an isolated target exists |
| Paid provider point-in-time recovery | Deferred Supabase Team PITR | Target: 24 hours | Target: 4 hours |
| Paid scheduled backup recovery | Deferred | Provider-dependent | Provider-dependent |

Prefer targeted correction. It changes only explicitly selected mutable fields and runs every current validation trigger. Never replace the whole row when unrelated valid work occurred later. Use forward repair for systematic errors and application rollback only for application code; neither is a substitute for restoring lost data.

## Targeted correction

1. Freeze edits and record incident UTC time, stable UUID/slug, suspected journal entry, affected fields, reason, executor, and two distinct approvers.
2. Inspect the exact journal sequence through the controlled `catalog_product_journal_for_product(uuid)` function. Confirm the selected entry belongs to the UUID and its `old_row` is the required before-image.
3. Verify later valid changes and list only mistaken fields in `CATALOG_RECOVERY_FIELDS`. Database-owned `id`, `slug`, `created_at`, and `updated_at` cannot be selected.
4. Set the required values locally without committing them:

```text
CATALOG_RECOVERY_PRODUCT_ID=<uuid>
CATALOG_RECOVERY_JOURNAL_ID=<journal id>
CATALOG_RECOVERY_FIELDS=card_name,archived_at
CATALOG_RECOVERY_REASON=<reviewed reason>
CATALOG_RECOVERY_APPROVERS=["<primary>","<backup>"]
CATALOG_RECOVERY_INVALIDATION_ORIGIN=https://pullpage.vercel.app
```

5. Run `npm run db:recover-product`. It executes one reviewed database transaction, validates the resulting complete row, then sends fixed-scope authenticated Catalog invalidation. If validation fails, no correction commits. If the command reports that the database committed but invalidation failed, do not repeat the correction; retry authenticated invalidation and retain that failure.
6. Match output UUID, slug, commit UTC time, and invalidation correlation ID to the new journal entry.
7. Within 60 seconds, verify in a fresh browser: shelf and search, canonical route, intercepted modal, title/description/canonical/social metadata, sitemap membership, and Product Preview or placeholder. Ensure unrelated later values remain intact.
8. Record results and unfreeze edits only after every output agrees.

Archive recovery uses `archived_at`. Restoring an archived row still must satisfy current formats/prices, Rarity, duplicate depiction, Product Preview, rights, and configuration constraints.

## Exceptional hard deletion

Archival is the routine removal mechanism. Hard deletion is only for a documented legal, privacy, or correction need and is prohibited for routine Catalog Editors.

Before proceeding:

1. Freeze edits and obtain two-person written approval.
2. Archive the Catalog Product and verify shelf/search withdrawal, branded `noindex` not-found routes, metadata withdrawal, sitemap removal, and Product Preview withdrawal.
3. Produce and verify a fresh encrypted independent export. Record its location, size, inventory counts, UTC time, and recovery owners.
4. Preserve the exact journal before-image and immutable UUID/slug.
5. Decide and record the linked rights-evidence and Cloudinary disposition. Never destroy rights evidence merely because its public asset was withdrawn.
6. Have counsel define any legally required erasure exception before deletion. If the law requires journal or backup erasure, counsel must define scope, authority, retention override, backup handling, and evidence that can legally remain; do not improvise or silently rewrite append-only evidence.

Set the same common recovery values (without journal ID/fields), then run `npm run db:hard-delete-product`. The database rejects deletion unless the row is already archived and two distinct approvers are supplied. Retain the DELETE journal before-image, transaction evidence, invalidation correlation, and post-delete public verification. Confirm hard and modal routes are branded `noindex` not-found, stale facts are absent, and sitemap/Product Preview references remain withdrawn.

## Independent encrypted export

Install PostgreSQL client tools matching the hosted major version, `age`, and `tar` on a controlled recovery workstation. Keep the age private identity outside Supabase and outside the backup destination. Set:

```text
CATALOG_BACKUP_AGE_RECIPIENT=<age public recipient>
CATALOG_BACKUP_DESTINATION=<external mounted path>/catalog-<UTC timestamp>.tar.age
```

Run `npm run db:export-catalog`. The process:

- inventories required private/public schemas, tables, views, trigger, recovery roles, and row counts;
- creates a custom-format dump of `catalog_private` and `catalog_public` plus role definitions;
- verifies the dump catalog parses;
- packages and encrypts the dump, roles, and manifest with age;
- removes temporary plaintext and rejects an empty encrypted output.

Copy the encrypted archive to storage controlled outside the Supabase organization. Retain 35 daily copies, 12 month-end copies, and every pre-destructive copy for at least one year unless counsel mandates a documented erasure exception. Test age-key access quarterly. Never commit exports, manifests, identities, database URLs, or private rights evidence.

## Isolated whole-restore rehearsal

Never restore over Production and never run a drill against Production. Provision a disposable non-production PostgreSQL/Supabase target with no shared runtime credentials.

1. Freeze edits/migrations and obtain two-person approval. Record source export UTC, recovery target, expected RPO/RTO, and drill start.
2. Preserve the target's current data if any. Decrypt into a permission-restricted temporary directory, inspect the manifest, restore role definitions, and restore the custom dump.
3. Set `CATALOG_VERIFY_DATABASE_URL` to the isolated target and run `npm run db:verify-catalog`.
4. In addition to inventory/count equality, test constraints, RLS, grants, immutable slugs, validation triggers, active views, Product Preview rights/configuration, journal append-only behavior, targeted correction, and controlled hard deletion inside rollback transactions.
5. Replay any valid work after the selected export in journal order. Re-run inventory and invariants.
6. Point an isolated Preview deployment at the restored target, invalidate its Catalog generation, and smoke-test shelf, search, canonical route, modal, metadata, sitemap, previews/placeholders, archive, and restore.
7. Record completion, achieved RPO/RTO, approvers, executor, evidence links, differences, and cleanup. Reopen edits only in the original environment after confirming the drill made no Production changes.

A dump that merely parses is not a successful rehearsal. Schema, constraints, roles/grants, RLS, views, triggers, reference data, Catalog Products, rights data, and journal entries must all be proven.

## Evidence record

Every recovery or destructive rehearsal retains:

- incident/drill identifier; environment; start/end UTC times;
- primary and backup approvers; executor; access-review status;
- stable UUID and slug; exact fields; source and resulting journal IDs; transaction IDs;
- reason and legal/counsel decision where applicable;
- export location, encrypted size, manifest/object/count verification, retention class;
- validation and rollback results; replayed later valid work;
- invalidation time/correlation ID and generation behavior;
- shelf, search, canonical route, modal, metadata, sitemap, Product Preview, `noindex`, and not-found evidence;
- selected and achieved RPO/RTO; failures, remediation, and edit-freeze release.
