# Evaluate Supabase backup, audit, and recovery capabilities

Type: research
Status: resolved
Blocked by:

## Question

What first-party Supabase backup, point-in-time recovery, Dashboard activity/history, database auditing, and restore capabilities exist by plan, and what minimum recovery contract is appropriate for automatic Dashboard-to-public updates and exceptional hard deletion?

## Answer

### Decision

The minimum production service is **Supabase Team with Point-in-Time Recovery (PITR) explicitly enabled for at least 14 days**, plus a database-level row-change journal and encrypted daily logical exports held outside the Supabase organization. Scheduled backups, PITR, platform Audit Logs, PostgreSQL audit logs, and the row journal serve different purposes; none substitutes for all the others.

Normal catalog exclusion remains reversible `archived_at`. Hard deletion is an exceptional, approved maintenance operation—not a normal Dashboard editing action—and must leave a retained before-image in the row journal and the incident/change record.

Commercial entitlements can change. At provisioning and every annual review, record the purchased plan, scheduled-backup retention, PITR retention and latest available restore point, platform/Postgres log retention, support tier, and restore procedure from the live Supabase Dashboard and pricing page. A plan name alone is not recovery evidence.

### First-party capability by plan

Supabase currently documents this baseline:

| Capability | Free | Pro | Team | Enterprise |
| --- | --- | --- | --- | --- |
| Scheduled database backups | No production recovery contract | Daily, retained 7 days | Daily, retained 14 days | Contract/configuration dependent, with longer retention available |
| PITR | Unavailable | Paid/additional capability when explicitly enabled | Available when explicitly enabled; do not assume the Team subscription enabled it | Contract/configuration dependent |
| Platform Audit Logs for Dashboard/Management API activity | Unavailable | Unavailable | Available | Available |
| PostgreSQL/other platform log retention | 1 day | 7 days | 28 days | Custom/longer retention, commonly 90 days in the plan matrix |
| Support/recovery escalation | Community | Email support | Priority support and SLA features | Contracted support/SLA |

Platform Audit Logs on Team/Enterprise are retained for the period documented by Supabase (currently 90 days) and identify control-plane actions and actors. They are not a row-version store and must not be assumed to contain old/new Catalog Product values or provide an Undo button. The implementation must verify with representative Table Editor changes exactly which event, actor, target, and metadata fields Supabase records.

Supabase scheduled backups and PITR protect the Postgres database:

- Scheduled backups are recovery points, not continuous history; a daily-only strategy can lose nearly a day of accepted Dashboard changes.
- PITR continuously archives PostgreSQL write-ahead log (WAL) and permits choosing a restore point inside the configured retention window. The latest restorable point can lag current time, so the runbook must inspect the Dashboard rather than promising zero data loss.
- Dashboard restore is a whole-database, in-place disaster-recovery operation with project downtime. It is not a selective table/row restore and rewinds unrelated valid changes made after the chosen point.
- Database backups contain Storage metadata but not deleted Storage objects themselves. They also do not protect Vercel configuration, Cloudinary Product Preview assets, repository code, organization access, or external secrets. Those require their own ownership and recovery controls.
- Backup download/format availability varies with backup type and project size. PITR/physical backups should not be assumed to provide a portable logical dump; the independent logical export below is therefore mandatory.

Free is unsuitable for production. Pro plus custom auditing can recover data, but it cannot meet the selected named-Dashboard-actor evidence contract because first-party platform Audit Logs start at Team. If the business chooses Pro for cost reasons, the replacement specification must explicitly record that weaker accountability as an accepted risk; it is not equivalent to this decision.

### Audit layers

Use all three audit layers below:

1. **Platform Audit Logs (Team)** — establish which individual Supabase organization member used the Dashboard or Management API and when. Every maintainer has an individual account with MFA; shared accounts are prohibited.
2. **`pgaudit` and PostgreSQL Logs Explorer** — enable focused write and DDL auditing for the private `catalog` schema. Log catalog writes, role/grant changes, trigger changes, and DDL; avoid indiscriminate read logging. Restrict log access because statement text can contain catalog values or secrets, and export required evidence before the Team retention window expires.
3. **Append-only row-change journal** — a trigger on the Catalog Product table records, in the same transaction, operation (`INSERT`, `UPDATE`, `DELETE`), stable product identifier/slug, timestamp, database role, transaction identifier, and complete `old_row`/`new_row` JSON. This is the authoritative source for targeted undo and before/after facts.

Put the journal in a private audit schema. Ordinary Dashboard editing guidance and the application runtime role receive no ability to update or delete journal rows. The trigger is migration-owned and is changed only through reviewed migrations. Supabase project owners/database superusers can ultimately bypass database protections, so this is append-only operationally rather than cryptographically immutable; individual platform accounts, Platform Audit Logs, and off-Supabase exports provide the additional tamper evidence.

The database role seen by a trigger may be a shared administrative role rather than the human Dashboard identity. Correlate journal timestamps/transactions with Platform Audit Logs; do not fabricate a human actor column when the database cannot supply one. Before launch, test whether representative Table Editor insert, edit, archive, and delete actions can be correlated unambiguously. If they cannot, hard deletion must be performed only through a controlled, individually attributable maintenance connection or process—not the Table Editor.

### Independent recovery copy

Once per day, use the trusted migration/direct-or-session connection—not the read-only Vercel runtime credential—to create a logical dump of the `catalog` and private audit schemas. Encrypt it, store it in a different provider/account with access logging and immutability/versioning, and retain:

- 35 daily copies;
- 12 month-end copies; and
- any pre-hard-delete or pre-migration copy for at least one year.

Never write database credentials into the archive or logs. A backup is not accepted merely because a job reports success: automatically verify non-zero expected tables/row counts and perform a restore rehearsal into an isolated non-production database at least quarterly. The rehearsal must prove schema, constraints, RLS, roles/grants, triggers, Catalog Products, and journal entries—not just that the dump file parses.

### Recovery objectives

| Incident | Recovery point objective | Recovery time objective |
| --- | --- | --- |
| Mistaken field edit, archive, or one/few-row deletion | Exact committed before-image from the row journal; no intentional unrelated change loss | Correct and verify within 1 staffed hour |
| Corrupt bulk Dashboard change | Exact pre-change journal state where practical; otherwise PITR latest point before the transaction | Contain within 30 minutes; restore service/data within 4 staffed hours |
| Database loss/corruption | Latest usable PITR point, with a target of no more than 5 minutes of committed data loss; replay later valid changes from journal/export | Restore within 4 hours, subject to measured Supabase restore duration |
| Supabase organization/project loss or provider backup unavailable | Last verified independent daily dump: up to 24 hours of database changes, reduced by any exported journal evidence | Restore into replacement infrastructure within 1 business day |

These are Pullpage operating objectives, not claims that Supabase contractually guarantees those times. Quarterly exercises must measure actual restore duration; missed objectives require a documented remediation owner and date.

Ticket 03's last-known-good Next.js cache may keep the public catalog readable during a database incident, but it is neither a backup nor an authoritative recovery source. It may also preserve incorrect content after a bad accepted edit. Incident response must invalidate the catalog tag only after corrected database data validates successfully.

### Recovery procedures

#### Accidental edit/archive/delete

1. Stop further catalog edits and record the incident time, affected stable identifiers/slugs, reporter, and current PITR latest restore point.
2. Correlate the row journal, PostgreSQL audit logs, and Platform Audit Logs. Preserve/export relevant evidence before making corrections.
3. Restore only affected rows/fields from the journal in one reviewed transaction. Re-run schema/content validation. Never perform a whole-project PITR restore for a recoverable single-row mistake.
4. Trigger/verify catalog cache invalidation, then smoke-test the shelf, canonical product route, intercepted modal, metadata, sitemap, and unknown/archived behavior.
5. Record who approved and executed recovery, exact SQL/change, verification evidence, and whether notification or process changes are required.

#### Whole-database PITR/scheduled-backup restore

1. Declare maintenance, freeze Dashboard edits and migrations, preserve the current database with a fresh logical dump if it remains readable, and record the target transaction/time in UTC.
2. Prefer proving the target in an isolated replacement/forensic project when the purchased Supabase tooling/support permits it. Do not assume the Dashboard can selectively restore or clone a backup.
3. If an in-place Supabase restore is required, obtain two-person approval because all later database changes may be lost and the project will be unavailable.
4. Restore to immediately before the bad transaction, then validate schema/migration state, extensions, roles/grants/RLS, triggers and webhooks, active/archived Catalog Product counts, duplicate/price constraints, and DAL read access.
5. Replay known-good later changes from the journal/current dump, validate the complete public projection, invalidate the cache, and run production smoke tests before reopening Dashboard editing.
6. Rotate credentials only when exposure is suspected; otherwise verify all external integrations and secrets because database restore alone does not restore Vercel/Cloudinary/Supabase organization configuration.

### Hard-deletion gate

A Catalog Product may be hard-deleted only when archival cannot satisfy a documented legal, privacy, or data-correction requirement. Before deletion:

- identify the stable record and all related audit/rights/image references;
- obtain two-person approval with reason and retention/legal constraints;
- confirm PITR is healthy and its latest point is recent;
- create and verify a pre-change encrypted logical export;
- confirm the row-journal trigger is enabled; and
- schedule the action through a controlled maintenance transaction.

After deletion, retain the journal before-image and approval record for at least one year unless the deletion basis legally requires erasing those values too. In that case, counsel must define what minimal non-content tombstone may remain, and backups/exports containing the data must follow a documented expiry/destruction schedule. Verify cache invalidation, public 404/noindex, sitemap removal, and any separate Cloudinary/rights-register disposition. A hard deletion is not complete merely because the database row disappeared.

### Acceptance evidence

Before launch, provide:

1. a screenshot/export recording Team plan, scheduled-backup retention, enabled PITR window, latest restore point, and log/audit retention;
2. representative insert/update/archive/delete evidence correlated across Platform Audit Logs, `pgaudit`, and the row journal;
3. privilege tests proving the runtime role cannot alter the journal, plus evidence that the designated Catalog Product editing workflow does not expose journal mutation; project owners remain an acknowledged superuser boundary;
4. a successful targeted single-row recovery with no unrelated changes lost;
5. a PITR rehearsal in non-production, including measured downtime and replay of a later valid change;
6. a successful isolated restore from the independent encrypted dump;
7. a hard-delete drill including two-person approval, before-image, cache invalidation, 404, and sitemap removal; and
8. named primary/backup recovery owners with access to Supabase, independent archives, Vercel, and Cloudinary.

### Primary sources

- Supabase, [Database Backups](https://supabase.com/docs/guides/platform/backups) — scheduled backup retention, PITR/WAL behavior, restore limitations, physical backups, and Storage-object exclusion.
- Supabase, [Point-in-Time Recovery](https://supabase.com/docs/guides/platform/backups#point-in-time-recovery) — PITR enablement, retention, latest restore point, and restore workflow.
- Supabase, [Audit Logs](https://supabase.com/docs/guides/platform/audit-logs) — Team/Enterprise availability, actor/action records, retention, and Dashboard access.
- Supabase, [Logging](https://supabase.com/docs/guides/platform/logs) and [Pricing](https://supabase.com/pricing) — plan log retention and current commercial entitlements.
- Supabase, [`pgaudit`](https://supabase.com/docs/guides/database/extensions/pgaudit) — enabling PostgreSQL audit logging and configuring audited statement classes.
- Supabase, [Database Webhooks](https://supabase.com/docs/guides/database/webhooks) — trigger-based asynchronous change notifications; useful for cache invalidation/alerts but not a durable audit history.
- Supabase CLI, [`supabase db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump) — first-party logical dump tooling.
- PostgreSQL, [Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html) and [JSON creation functions](https://www.postgresql.org/docs/current/functions-json.html) — transactionally recording `OLD` and `NEW` row values.
- PostgreSQL, [`pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html) and [`pg_restore`](https://www.postgresql.org/docs/current/app-pgrestore.html) — portable logical backup and restore behavior.
