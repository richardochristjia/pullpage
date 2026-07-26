# Catalog environment promotion and release runbook

## Environment inventory

The committed inventory is `config/catalog-environments.json`. It records provider identifiers and credential *names*, never values. Local, Preview, and Production have separate data, roles, runtime credentials, migration credentials, invalidation secrets, Cloudinary configuration, and backup targets.

| Environment | Supabase | Region | Vercel scope | Data |
| --- | --- | --- | --- | --- |
| Local | CLI project `pullpage` | workstation | local Node.js | disposable deterministic synthetic fixture |
| Preview | `PULLPAGE_PREVIEW_PROJECT_REF` in the dedicated Pullpage organization | Singapore (`ap-southeast-1`) | Pullpage project / Preview target, Node.js `sin1` | deterministic synthetic fixture only |
| Production | `PULLPAGE_PRODUCTION_PROJECT_REF` in the dedicated Pullpage organization | Singapore (`ap-southeast-1`) | Pullpage project / Production target, Node.js `sin1` | Production Catalog only |

The owner-approved free-plan cutover temporarily uses the available Singapore project as a fully qualified target, transfers and verifies Production state, deploys it, pauses the Tokyo rollback project, and then creates the final isolated Preview project. Rollback requires pausing one Singapore project before unpausing Tokyo because Supabase enforces two active free projects per owner. Never delete the paused rollback project during the compatibility window.

## Identities and secrets

- `catalog_runtime`: login through the transaction pool only, `max: 1`, bounded acquisition/statements, TLS, and SELECT on the public projection only.
- Migration identity: hosted `postgres` through direct/session access, TLS, finite lock/statement bounds, and available only to the protected migration job.
- Backup/recovery identity: owner-controlled direct/session credential, absent from Vercel.
- `catalog_editor`: routine non-destructive Dashboard editing role.
- `catalog_recovery_operator`: explicitly elevated reviewed recovery role.
- Named Supabase/Vercel/GitHub accounts require MFA; shared accounts are prohibited.

Vercel Production contains only `CATALOG_DATABASE_URL` and `CATALOG_REVALIDATE_SECRET`. It never contains database passwords, migration URLs, recovery access, backup keys, Supabase access tokens, or private rights evidence. Preview receives only Preview values. Pull-request CI receives no hosted values; protected Preview promotion uses GitHub environment secrets.

## Ownership

Primary owner for Migration, Deployment, Recovery, Dashboard, rights, cache/webhook, Cloudinary, and performance: **Richard O. Christjia**. A distinct named MFA backup and second approver must be designated before any future destructive migration, hard deletion, or emergency recovery. Escalate database/schema incidents to Recovery, rights incidents to rights ownership, delivery incidents to Deployment/cache, and latency or connection incidents to performance ownership. The current free-plan release is owner-approved and contains no destructive schema migration.

## Local and CI

`npm run db:reset` is local-only, applies immutable migrations from zero, and then invokes the guarded synthetic fixture. Production has no seed command or automated seed step. `npm run catalog:verify-tooling` checks immutable migration hashes, rejects prohibited hosted reset/schema-push/development workflows, and generates Prisma twice to prove deterministic output.

Untrusted pull requests run `.github/workflows/catalog-ci.yml` without hosted credentials. It reproduces the database from zero, verifies drift, runs module/database/browser tests, and separately upgrades the prior schema with the 500-product fixture. Upgrade evidence records duration, counts, representative public facts, compatibility, rollback, and forward-repair guidance.

Never run Prisma schema push, Prisma development migration, Prisma Studio, Supabase reset, or seed against Preview or Production. Never edit an applied migration or migration history row. Add a later reviewed migration.

## Preview promotion

The protected `.github/workflows/catalog-preview-promotion.yml` job is single-flight and never cancels an in-progress migration.

1. Record the exact commit and migration manifest; require the workflow commit to match.
2. Use Preview direct/session migration access and take the database advisory promotion lock.
3. Apply pending migrations; optionally reapply owned synthetic fixtures only with the explicit non-production flag.
4. Verify schema, checks, indexes, functions, triggers, views, RLS, grants, Rarity data, webhook triggers, audit journal, recovery operations, and row counts.
5. Deploy the exact commit to Vercel Preview in `sin1`.
6. Run integration and browser smoke tests covering routes, local browsing, cache invalidation, archive/restore, outage behavior, audit, and targeted recovery.
7. Retain the public deployment URL, exact commit, migration list, test results, and inventory without secret values.

## Production release

1. Announce and enforce a Dashboard edit freeze. Record the UTC start, exact commit, unapplied migrations, release owner, approval, and rollback threshold.
2. Confirm Supabase plan capabilities. Free-plan PITR is unavailable and must be recorded as such; do not claim a recovery point that does not exist.
3. Create and cryptographically verify a fresh independent encrypted release snapshot. Keep its key separate from both Supabase and the ciphertext. Retain inventory/count evidence and the earlier recovery export.
4. Verify target schema, source/target public facts, audit journal counts, roles/grants, RLS, webhooks, and migration status. Confirm the previous project remains available for rollback.
5. Run `npm run db:migrate:production` outside the Vercel build with edit freeze, exact commit, export reference, and required approvers. No seed step exists.
6. Configure Vercel Production with only the new read-only transaction-pool runtime URL and invalidation secret. Deploy the exact reviewed commit to `sin1`.
7. Verify shelf, search, canonical route, modal, metadata, robots, sitemap, preview/placeholder, automatic invalidation, archive/restore, safe outage behavior, audit, recovery, connection count, and latency.
8. Reopen editing only after all checks pass. Pause—not delete—the previous project after the compatibility window begins and record the final inventory.

## Destructive SQL and backfills

Destructive changes use separate expand, bounded backfill, and later contract releases. New destructive migration SQL is rejected unless it records:

- expand/backfill/contract phases and a compatibility window;
- finite lock and statement timeouts plus measured Preview duration;
- two distinct approvers;
- a recovery threshold and verified export;
- old/new application compatibility and the later contract release.

Stop before the threshold. Do not improvise a long lock or large transaction in Production.

## Failure and repair

- **Application defect, sound database:** redeploy the prior application commit; do not alter migration history.
- **Migration transaction failed and rolled back:** diagnose, correct a new unapplied migration if necessary, and retry through the protected job.
- **Partial/non-transactional migration:** freeze edits, preserve logs and database state, inspect exact applied objects, and use a reviewed forward repair.
- **Migration recorded incorrectly:** use migration resolution only after proving actual database state; never rewrite an applied SQL file or history row.
- **Incorrect Catalog values:** use targeted journal recovery and fixed-scope invalidation from the recovery runbook.
- **Database loss/corruption:** restore immutable migrations and the verified independent export into an isolated target, verify it, then promote.
- **Free-plan Singapore cutover rollback:** pause a Singapore project if needed, unpause Tokyo, restore its protected Vercel runtime values, deploy the recorded prior commit, invalidate, and smoke-test before reopening edits.

Retain timestamps, executor/approver, commit, migration versions, lock duration, counts, public facts, snapshot verification, cache correlation, smoke results, failure point, and final edit-freeze state for every rehearsal and release.
