# Original PNG migration batch — private B2 dashboard workflow

Operator toolkit, not application/runtime code. New scoped migration preparation (#60), following bounded pilot #57 and source inventory #58. Configuration audit #59 paused at operator request; its unresolved partner/capacity/traffic findings are not waived or magically cleared. This toolkit does not upgrade/deploy/write the app, Workers, database, credentials, B2 objects or paid settings.

## Actual scope

Snapshot: 126 PNG objects, 123,091,877 bytes; 124 Catalog Products = 122 legacy Supabase URLs + one existing Worker URL + one empty preview. Copy **every source object unchanged**, including four not currently legacy-referenced. Never assume those four are deletable. Preserve the existing pilot/empty/external URLs; prepare replacements only for legacy references that match source keys. Counts are refreshed from CSV, not coded into execution.

Stages are separate: private inventory → dry-run plan → expressly bounded source GET/download → operator dashboard upload → expressly bounded public hash verification → private URL mapping → separately approved operator Catalog cutover. No database mutation functions or upload keys exist in this package. Nothing auto-deletes or starts a 14-day retirement clock.

## 1. Private source CSV (no credentials)

In named/MFA Supabase Production `vozvldzmzfdohusojrfq`, run `export-inventory.sql` in SQL Editor. Transaction is READ ONLY. Export **CSV**, not JSON. Expected initial snapshot: 250 records (126 object + 124 product). Query returns object names and trusted row IDs/slugs/URLs/timestamps; these are private operator inputs, never pasted into chat/issues or committed.

Save outside checkout/iCloud in an owner-only directory, for example:

```bash
umask 077
private="$HOME/Library/Application Support/pullpage/object-migration"
mkdir -p "$private"
chmod -N "$private"
chmod 700 "$private"
# Save/move SQL Editor CSV export as "$private/inventory.csv".
# After export:
chmod -N "$private/inventory.csv"
chmod 600 "$private/inventory.csv"
```

Do not substitute `.dev.vars`, API responses or keys. No private origin URLs or credentials are needed. Do not save into repo, Downloads indefinitely, Desktop/iCloud or synced folders.

## 2. Prepare real batch (zero network)

From repository root:

```bash
private="$HOME/Library/Application Support/pullpage/object-migration"
node migration/product-previews/cli.mjs prepare \
  --inventory "$private/inventory.csv" \
  --batch "$private/batch-01"
node migration/product-previews/cli.mjs status --batch "$private/batch-01"
```

CLI outputs counts only. Plan/progress are private (directories 700, files 600), refused inside repo even through symlink. Fresh random batch namespace produces flat `preview-migration-<batch>-<source-key-hash>-v1.png` names accepted by existing PNG Worker. Do not change names/plan after preparing. Original filename changes, **image bytes do not**. Changed future content needs a new reviewed `-vN` filename; no published overwrite.

CSV parsing preserves escaped commas/quotes/UTF8. URL percent escapes decode once; literal `+` remains `+`. Source path/host cannot escape fixed Production bucket; unsupported formats, missing references, bad metadata, duplicate keys/IDs, malformed escapes/query aliases and >5 MiB fail before fetch. Existing Worker/external/empty references remain untouched.

## 3. Explicit source-download approval

`download` defaults to zero network. Obtain approval for fresh current counts/bytes before `--execute`: source GETs consume **Supabase Storage egress**, not B2 space. No claim source-account egress is free, historical usage reversible, or $0 B2 caps cover Supabase. Never copy old pilot's spent request allowance.

For the unchanged initial snapshot only, approved download would be:

```bash
node migration/product-previews/cli.mjs download \
  --batch "$private/batch-01" --execute --attempt 1 \
  --max-requests 126 --max-bytes 123091877
```

Sequential GET only, fixed source origin, identity encoding, manual redirects, 30-second deadline/image, exact declared MIME/length/size, PNG signature, optional source ETag pin, SHA-256 and original bytes. No transform/reencode/upload/retry. One-use attempt/report retained. Download folder contains safe renamed `.png` files only, not private manifests. `status` rehashes prior local successes; resumes require NEW explicit remaining-request/byte budget + new attempt number. Corrupted/untracked files/changed plan stop, never overwrite or blindly resume. Failed attempt reports are immutable; progress may advance under subsequent approved attempts.

## 4. Operator uploads unchanged bytes

After all downloads are verified, operator opens B2 `pullpage-previews` upload dialog and uploads only `batch-01/images/*.png` using existing account UI. No new key, upload application, public bucket, secret/qualification change or code deployment. Fresh namespace must be exclusively owned by this batch; don't let another uploader use these names. Never select overwrite/replace and never delete existing files. Existing B2 uploads before this batch remain.

B2 stays private. The dashboard/browser must store `image/png`; public URL is Worker URL, not Friendly/S3/Native/token URLs. Only upload stage approval permits actual upload; local preparation alone does not. Inspect upload completion/error/count before retry; don't blindly restart failed uploads.

## 5. Separately approved public verification

`verify` defaults to zero network. After operator confirms all uploads, get a NEW bounded Worker GET budget (initial snapshot 126 requests / 123,091,877 client bytes; not permission inferred from this example). Current daily quotas can change. No paid fallback/raise caps/CPU, purge, query aliases or retry.

```bash
node migration/product-previews/cli.mjs verify \
  --batch "$private/batch-01" --execute --attempt 1 \
  --max-requests 126 --max-bytes 123091877
```

Every intended public file must be 200 PNG, exact length/signature/SHA-256 from local originals, immutable expected cache policy and no origin/cookie/auth/redirect header leaks. Only complete success emits private `verify-1-cutover.json`. Failed/missing/changed target blocks **all** mapping emission for that attempt. A successful HTTP/hash run is integrity proof, not deployed peak memory/concurrent-miss, partner billing, maximum CPU or independent browser verification. Do not silently mark those earlier gaps cleared; declare scoped rollout risks separately.

## 6. Guarded operator Catalog handoff (separate scope)

Verified mapping has ID, unchanged slug, exact expected old URL/updated_at, new Worker URL and SHA-256 for each legacy row. Keep it private. Before **each** separately approved manual URL edit, check ID/slug/current URL/timestamp still match snapshot; stop on editor conflicts. Change only `product_preview_url`, not business facts/prices/visibility/slug/IDs. Database may advance `updated_at` automatically. No agent DB writes or app write endpoint.

Preserve old mapping/files. Rehearse guarded row rollback before broad cutover; don't assume old Worker version remains usable after its credential expires. Current production credential expiry was checked to reported December 31, 2026, 4:47 PM GMT+7; manual renewal remains necessary. Metadata/sitemap/network/fallback/frontend and observed full-cutover counts need separate evidence. No full-cutover/14-day/retirement claim until approved completion. Existing historical R2 ADR is not superseded by preparation.

## Guarded SQL preparation (one-off operator workflow)

After successful full batch verification, prepare **private** SQL without connecting to any database:

```bash
node migration/product-previews/cli.mjs prepare-cutover --batch "$private/batch-01"
```

Generated `catalog-cutover/` files:

- `01-preflight-readonly.sql`: read-only snapshot counts. Initial batch must show **122 expected/matching changes; 124 expected/current/matching products**. Mismatches mean stop; do not relax guards.
- `02-cutover.sql`: **production write** of exactly 122 `product_preview_url` values. Preparation is NOT execution approval. Run only after separate owner approval in named/MFA Production SQL Editor, whole script once. Transaction takes bounded write-blocking table lock (ordinary reads continue), checks ID/slug/exact old URL/full-microsecond timestamp for all 124 rows, updates only previews, and aborts on unexpected fact/identity/kept-row mutations. Database-owned `updated_at` advances automatically; no timestamp assignments, constraints/triggers/RLS disabled, persistent schema changes, or other facts edited.
- `03-capture-receipt-readonly.sql`: after **confirmed COMMIT**, export exactly 122 receipt rows as protected CSV. Includes old/new URL, actual after-timestamp and full-row SHA-256. Zero rows means post-state conflict, not a valid receipt. Run promptly, before more edits. If cutover times out or commit is ambiguous, inspect read-only preflight/post-state before any second write; never blindly rerun. A query result alone does not prove transaction committed.
- `README.txt`: private operator reminders. No generated row data belongs in issues/chat/repository.

Rollback SQL cannot be safely generated from pre-cutover timestamps alone. Return actual committed receipt file path, then:

```bash
chmod -N "$private/receipt.csv"
chmod 600 "$private/receipt.csv"
node migration/product-previews/cli.mjs prepare-rollback \
  --batch "$private/batch-01" --receipt "$private/receipt.csv"
```

This creates private `04-rollback.sql`; **does not run it**. Only same verified 122 IDs/slugs/old/new URLs accepted. Rollback requires actual after-URL, timestamp and SHA-256 of complete current row to match receipt before **any** restore. Later edits cause all-or-none stop. Rollback restores URLs only, never prices/facts/identity/visibility or old timestamps. A newly captured receipt is a newly reviewed rollback baseline, not proof nobody edited since cutover. Preserve original committed receipt separately; do not replace it to bypass conflict guards. Application read role is not elevated and no agent DB credentials/connections exist.

SQL is one-off operator automation consistent with direct named-account editing, an explicit exception to ordinary Table Editor workflow; it does not supersede historical Supabase-upload ADR/guide or implement app writes. Use exact Production project and review owner approval/risk: original-byte delivery integrity passed, but actual partner accounting, full traffic/capacity and browser/metadata/sitemap/rollback acceptance remain unresolved. Saved $0 caps may interrupt delivery; never enable paid fallback or raise limits to make this pass. Ordinary Catalog refresh remains approximately 60 seconds; no Vercel/Worker deployment.

Old objects/URLs/backups retained. Preparation/COMMIT alone does not establish verified full cutover or start historical 14-day retirement period; representative frontend and guarded rollback evidence remain distinct. Production write/verification requires fresh scope, not any spent image/private API allowance.

## Offline checks

```bash
npm --prefix migration/product-previews test
node migration/product-previews/cli.mjs
```

Built-in Node only; no root framework/dependency/lockfile changes or real credentials. SQL integration tests use installed `initdb`, `pg_ctl` and `psql` to start disposable PostgreSQL over owner-only Unix socket with TCP disabled and isolated environment; skipped where unavailable. No hosted database connections. Synthetic local PostgreSQL proof and mocked HTTP tests are not production cutover evidence.
