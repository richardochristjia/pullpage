# Define Supabase environments, Prisma migrations, and seeding

Type: research
Status: resolved
Blocked by: 01, 02, 04

## Question

What development, preview, and production project/database separation, Prisma migration workflow, direct versus pooled credentials, seed/fixture approach, destructive-change safeguards, and rollback ownership should the replacement specification require?

## Answer

Require three isolated database environments: local Supabase for development/test, one persistent non-production Supabase project for trusted Vercel Preview/release rehearsal, and one dedicated production Supabase project. Promote reviewed migration files—not databases or Dashboard schema changes—from local/CI to Preview and then Production. Seed only synthetic non-production data; production Catalog Products are entered through Supabase Dashboard after the schema and protected configuration are ready.

### Environment contract

| Environment | Database | Data | Runtime credential | Migration credential | Reset policy |
| --- | --- | --- | --- | --- | --- |
| Unit/component tests | No database unless the test is explicitly an integration test | Checked-in plain DTO/invalid-case fixtures | None | None | Recreate in memory per test |
| Local development/integration | Supabase CLI local stack per developer/CI worker | Deterministic synthetic, independently rights-cleared fixtures | Local read-only login; direct local connection is acceptable | Local owner/migrator plus an isolated local shadow database | `prisma migrate reset` is allowed only here |
| Preview/release rehearsal | A persistent Supabase project separate from Production | Synthetic data only; never a production clone or private production rights evidence | Preview project's read-only login, scoped only to trusted Vercel Preview branches/custom environment | Preview project's migrator, held only by the protected migration job | Controlled reset/reseed is allowed with release-owner approval; preserve it when needed for recovery rehearsals |
| Production | Dedicated Supabase project in the business-controlled Team organization | Real approved catalog/configuration/rights data | Production read-only login through Supavisor transaction mode | Production migrator through direct IPv6 or Supavisor session mode | Never reset or fixture-seed |

The Preview and Production projects must have distinct project references, database passwords, custom login roles, webhook secrets, Cloudinary configuration/folders, backup destinations, and Vercel environment values. They may be in the same business-controlled Supabase Team organization, but Production project access is limited to named release/recovery maintainers using individual MFA-protected accounts; ordinary Dashboard editors receive only the least project access needed.

Do not use Supabase branches as the initial environment boundary. A persistent Preview project is simpler to audit and is needed for migration, restore, webhook, pool, and Vercel rehearsals. If concurrent schema-changing pull requests later justify ephemeral branches, each branch must be built from the same committed Prisma migrations and synthetic seed, receive unique credentials, and be destroyed after the pull request; it must not copy Production data or become another schema authority.

Untrusted/fork pull requests receive no Supabase or Vercel database secret. A trusted protected Preview branch/custom environment may receive the Preview `DATABASE_URL`. Other pull requests prove behavior with checked-in fixtures and local/ephemeral CI services rather than sharing a credential that contributed code could exfiltrate.

### Source of schema truth

The committed Prisma migration history is the sole schema history after a one-time environment bootstrap. It must contain or explicitly invoke all reproducible database behavior accepted by tickets 01, 02, 03, and 04, including:

- the private `catalog` and audit schemas, tables, indexes, foreign keys, checks, functions, triggers, active-catalog view, RLS policies, and grants;
- required extensions and the initial controlled Rarity rows;
- database webhook definitions where they can be represented without embedding a secret; and
- the append-only row journal and migration-owned protections.

Prisma's declarative schema cannot represent every PostgreSQL trigger, function, view, extension, RLS policy, grant, or webhook. Generate migrations locally with `prisma migrate dev --create-only`, edit the SQL deliberately, then apply and test it. A successful `prisma generate` or Prisma schema diff alone is not evidence that those database objects exist.

The only exception is a versioned, reviewed, idempotent bootstrap runbook/script executed once per project with the Supabase administrative identity to create the non-superuser `catalog_migrator` login and replaceable runtime login credentials. Passwords and webhook secrets are injected securely and never committed. After bootstrap, Dashboard SQL/schema editing is prohibited for routine changes; Dashboard is for accepted data administration. Emergency SQL must be captured immediately as a migration/incident record and reconciled before another release.

Start every environment from migration 001; do not baseline an undocumented manually built Production schema. Never edit or delete a migration already applied to Preview or Production, and never modify `_prisma_migrations` by hand.

### Migration workflow

1. **Develop locally.** Update `schema.prisma`, create a named `--create-only` migration, add required hand-written PostgreSQL SQL, and review the complete data/lock effect. Use `prisma migrate dev` only against local development and its disposable shadow database.
2. **Prove from zero.** CI starts a clean local Supabase/Postgres service, runs the complete history with `prisma migrate deploy`, runs the non-production seed explicitly, validates Prisma generation, and tests constraints, triggers, view projection, RLS/grants, webhook configuration shape, and journal behavior. It also upgrades a fixture at the prior schema version to catch migration-path defects.
3. **Check drift.** CI compares the expected migration/schema state with the clean database and fails on unexplained drift. Because `migrate deploy` applies pending migrations but does not replace a full drift review, verify hand-written objects separately with catalog/behavior tests.
4. **Rehearse in Preview.** A protected, single-flight migration job uses Preview `MIGRATION_DATABASE_URL` to run `prisma migrate deploy`; then deploy the matching Vercel Preview commit and run catalog, product-route, archive, cache-invalidation, role, and recovery smoke tests. Do not run migration commands inside `next build`.
5. **Approve Production.** Record the exact commit and migration set, SQL review, Preview evidence, compatibility/rollback plan, current PITR restore point, successful pre-change encrypted logical export, and named executor/approver. Freeze Dashboard catalog edits for the release window.
6. **Migrate Production.** One protected release job, requiring human environment approval, records pre-deploy `prisma migrate status` (where the reviewed pending set is expected), runs `prisma migrate deploy` with Production `MIGRATION_DATABASE_URL`, then requires a clean post-deploy status. It validates the database invariants before discarding the credential.
7. **Deploy and verify.** Deploy the same reviewed application commit with only Production `DATABASE_URL`; run end-to-end smoke checks, invalidate the catalog cache when necessary, and verify audit/journal evidence before reopening Dashboard editing.

Pin one supported Prisma major during implementation and commit its lockfile. For Prisma 7, put the CLI datasource in `prisma.config.ts`, load environment variables explicitly for CLI execution, and point that datasource at `MIGRATION_DATABASE_URL`; the runtime adapter separately consumes `DATABASE_URL`. Regenerate the client deterministically in CI/build; vendor generated artifacts only if the selected version's documented project convention deliberately requires it.

Prohibit `prisma db push`, `prisma migrate dev`, `prisma migrate reset`, and Prisma Studio against Preview/Production. `prisma migrate resolve` is an incident-recovery tool: use it only after inspecting the actual database and recording whether a failed migration was fully rolled back, partially applied, or manually completed.

### Credential and connection rules

Ticket 01's split applies independently to each hosted environment:

- `DATABASE_URL` uses that environment's replaceable read-only login and transaction pooler (`:6543`). Vercel Production receives only Production runtime access; the protected Preview environment receives only Preview runtime access.
- `MIGRATION_DATABASE_URL` uses that environment's schema-owning migrator and a direct (`:5432`, IPv6) or Supavisor session (`:5432`) connection. It exists only for the protected migration/backup job, not Vercel builds or runtime.
- `SHADOW_DATABASE_URL` exists only for local migration development and points to a disposable non-production database that is not also the development database.

The backup/export job may use a separate narrowly scoped backup login where practical; it must not reuse the Vercel runtime credential. All hosted connections enforce TLS. Environment configuration records project references and secret owners, never secret values.

### Seed and fixture policy

Use two explicit fixture layers because the database owns random immutable slugs:

1. **Database seed (`prisma/seed.ts` or the pinned Prisma version's configured equivalent):** inserts synthetic Preview/local rights records, configuration, and Catalog Products with fixed UUIDs and deterministic source values. It covers all Rarities and format codes, missing optional facts, duplicate-card Design Names, active/archived rows, valid current/expired preview-rights cases, and the accepted 500-product scale. It queries generated slugs after insertion instead of assuming stable slug text. The seed is idempotent for its fixed IDs and may update only rows it owns.
2. **Checked-in public DTO fixtures:** use fixed slugs and stable ordering for unit, rendering, metadata, filtering, and performance tests. Invalid-case fixtures stay outside successful database seeding and are used to prove that database constraints or application validation reject them.

The initial `C`, `U`, `R`, `RR`, `AR`, `SR`, `SAR`, and `UR` rows are required reference data and travel in a committed migration so Production cannot omit them. The seed may safely confirm/upsert them in disposable environments. Production Cloudinary configuration is supplied through the controlled provisioning runbook; synthetic Cloudinary configuration and Product Previews must never refer to private Production assets.

Seeding is always an explicit command; do not rely on version-dependent automatic behavior after migration. The seed script must refuse known Production project references and require an explicit non-production allow flag. More importantly, Production automation never invokes the seed and the runtime role lacks writes. No real Catalog Product, private rights evidence, copied production dump, customer information, or production secret belongs in the repository or non-production seed.

### Destructive-change safeguards

Use expand-and-contract migrations across releases:

1. add nullable/new structures and dual-compatible views first;
2. deploy code that can operate with both old and new shapes and backfill in bounded, restartable batches;
3. validate counts, constraints, runtime projection, audit behavior, and backups; then
4. remove obsolete structures only in a later separately approved release.

Any `DROP`, rename, type narrowing, `NOT NULL`, uniqueness change, destructive data rewrite, extension removal, role/grant reduction, trigger/view replacement, or large backfill requires a migration risk note with affected rows/objects, lock expectations, tested duration, compatibility window, backup/PITR point, forward repair, and restore trigger. CI must flag such SQL for explicit two-person approval; Prisma's development warnings are not a Production safeguard.

Wrap PostgreSQL DDL in an explicit transaction when every statement supports transactional execution. Separate operations that cannot safely share that transaction, and prove their partial-failure recovery in Preview. Set finite lock/statement timeouts appropriate to the tested migration, avoid open-ended table locks, serialize migration jobs, and keep Dashboard writes frozen. Never combine exceptional Catalog Product hard deletion with a schema deployment; hard deletion follows ticket 04's separate two-person and before-image gate.

Before every Production schema change, verify the latest PITR point and create the independently stored logical export required by ticket 04. A backup job reporting success is insufficient: verify expected schemas/tables/counts. Destructive changes additionally require a tested restore/repair decision threshold before execution.

### Rollback and ownership

Prisma Migrate has no automatic down-migration safety contract. Prefer forward repair, and distinguish application rollback from database recovery:

| Failure | Required response |
| --- | --- |
| Application deploy fails after a backward-compatible migration | Roll back the Vercel deployment; leave the additive schema in place, diagnose, and redeploy. |
| Transactional migration fails and leaves no committed schema/data change | Keep the prior app live and inspect the cause. After verification, use `prisma migrate resolve --rolled-back` only to retry the unchanged migration after a transient cause is removed. If the SQL itself is wrong, stop the release and use Prisma's documented failed-migration repair procedure with a separately reviewed compensating artifact and reconciled history; do not hand-edit `_prisma_migrations` or silently change a file already applied elsewhere. |
| Non-transactional/partial migration | Freeze edits and releases; inspect exact applied state. Complete a reviewed forward repair only when proven safer than restore, then reconcile migration history with `migrate resolve`. Otherwise invoke the recovery plan. |
| Committed migration is wrong but data remains intact | Keep/restore the compatible app and ship a new compensating migration; never rewrite the applied migration. |
| Migration corrupts or removes data | Stop writes, preserve evidence, and use targeted journal recovery or the verified PITR/logical-export procedure from ticket 04. Do not improvise reverse SQL. |
| Seed failure in Local/Preview | Reset/reseed only the affected non-production environment after preserving evidence needed for the test; Production has no fixture seed path. |

Before launch, assign named primary and backup people for these roles:

- **Migration Owner:** controls migration artifacts/job, executes releases, verifies schema and migration history, and coordinates the Dashboard edit freeze.
- **Application Deployment Owner:** deploys/rolls back Vercel and performs route/cache smoke tests.
- **Recovery Owner:** controls PITR and independent exports and decides between forward repair, targeted recovery, and full restore under the ticket 04 runbook.
- **Second Approver:** independently reviews every destructive migration, Production `migrate resolve`, or restore. The executor cannot self-approve these actions.

One person may be both Migration and Application Deployment Owner for an ordinary additive release, but destructive changes and restore decisions always require two people. Each role and backup must have tested access before a release; ownership cannot exist only as an undocumented personal account.

### Acceptance evidence

Before implementation handoff/launch, demonstrate:

1. an environment inventory showing distinct Local/Preview/Production project references, roles, webhooks, Cloudinary configuration, Vercel scopes, and access owners without exposing secrets;
2. clean-database application of the complete migration history plus seed, followed by passing schema/constraint/RLS/view/journal tests;
3. upgrade of a prior-version 500-product database with measured lock/duration and unchanged public facts;
4. proof that untrusted previews and Production Vercel deployments contain no migration/shadow credential, and Preview cannot reach Production;
5. seed refusal against the Production project plus stable DTO fixture snapshots and expected database seed counts;
6. a Preview-to-Production release rehearsal with edit freeze, backup verification, migration status, deployment, cache invalidation, and smoke evidence;
7. a failed/partial migration drill showing controlled `migrate resolve` or restore rather than migration-history editing;
8. an additive-schema application rollback drill and a destructive-change recovery drill; and
9. named primary/backup owners and two-person approval records.

### Primary sources

- Supabase, [Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments) and [Local Development](https://supabase.com/docs/guides/local-development) — separate projects, local stack, migration/seed concepts, and environment-specific secrets.
- Supabase, [Branching](https://supabase.com/docs/guides/deployment/branching) — isolated branch credentials and preview-branch lifecycle considered but not selected as the initial boundary.
- Supabase, [Shared responsibility model](https://supabase.com/docs/guides/deployment/shared-responsibility-model) — customer responsibility for access, schema changes, secrets, and recovery validation.
- Prisma, [Development and production](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production), [Customizing migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations), and [Troubleshooting](https://www.prisma.io/docs/orm/prisma-migrate/workflows/troubleshooting) — `migrate dev`/shadow databases, `migrate deploy`, edited SQL, failed migrations, and `migrate resolve`.
- Prisma, [Seeding](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding) and [`prisma.config.ts`](https://www.prisma.io/docs/orm/reference/prisma-config-reference) — explicit seed commands and current Prisma configuration.
- Prisma, [About migration histories](https://www.prisma.io/docs/orm/prisma-migrate/understanding-prisma-migrate/migration-histories) and [Data migration](https://www.prisma.io/docs/guides/data-migration) — immutable applied history and expand/backfill/contract workflows.
- PostgreSQL, [Transactional DDL](https://www.postgresql.org/docs/current/ddl.html), [`pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html), and [`pg_restore`](https://www.postgresql.org/docs/current/app-pgrestore.html) — database transactions and logical recovery tools.
- Vercel, [Environment variables](https://vercel.com/docs/environment-variables) and [Custom environments](https://vercel.com/docs/deployments/environments) — Production/Preview scoping, branch assignment, and protected environment controls.
- Resolved local decisions: [connection/security topology](01-select-supabase-prisma-connection-security-topology.md), [database contract](02-define-supabase-catalog-schema-and-constraints.md), and [backup/audit/recovery](04-evaluate-supabase-backup-audit-and-recovery.md).
