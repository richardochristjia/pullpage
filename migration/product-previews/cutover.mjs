// Offline SQL generation only. Never connects to a database or performs a cutover.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { describeBatch, SOURCE, TARGET, parseCsv } from './batch.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const fail = () => { throw new Error('Cutover preparation guard failed'); };
const table = 'catalog_private.catalog_products';
export const RECEIPT_COLUMNS = ['batch_id', 'id', 'slug', 'before_preview_url', 'after_preview_url', 'after_updated_at', 'after_row_sha256'];
function safe(file, directory = false) {
  const st = fs.lstatSync(file);
  if (st.uid !== process.getuid() || (directory ? !st.isDirectory() : !st.isFile()) || (st.mode & 0o777) !== (directory ? 0o700 : 0o600)) fail();
  if (process.platform === 'darwin' && execFileSync('/bin/ls', ['-lde', file], { encoding: 'utf8' }).split('\n').slice(1).some(l => /^\s*\d+:/.test(l))) fail();
}
function json(file) { safe(file); return JSON.parse(fs.readFileSync(file, 'utf8')); }
function newFile(file, text) { fs.writeFileSync(file, text, { flag: 'wx', mode: 0o600 }); }
function timestamp(value) { return typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z$/.test(value) && Number.isFinite(Date.parse(value)); }
function payload(value) {
  const text = JSON.stringify(value), delimiter = '$pp_' + sha(text).slice(0, 24) + '$';
  if (text.includes(delimiter)) fail();
  return delimiter + text + delimiter + '::jsonb';
}
const fields = 'id uuid, slug text, action text, expected_url text, expected_updated_at timestamptz, new_url text';
const fingerprint = alias => `encode(sha256(convert_to(to_jsonb(${alias})::text, 'UTF8')), 'hex')`;
const stamp = alias => `to_char(${alias}.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
const transaction = readOnly => `BEGIN${readOnly ? ' READ ONLY' : ''};\nSET LOCAL lock_timeout = '5s';\nSET LOCAL statement_timeout = '30s';\nSET LOCAL timezone = 'UTC';\nSET LOCAL search_path = pg_catalog, pg_temp;\n`;
const beforeMatch = 'p.id = i.id AND p.slug = i.slug AND p.product_preview_url IS NOT DISTINCT FROM i.expected_url AND p.updated_at = i.expected_updated_at';
const afterMatch = "p.id = i.id AND p.slug = i.slug AND p.product_preview_url IS NOT DISTINCT FROM CASE WHEN i.action = 'replace' THEN i.new_url ELSE i.expected_url END";

function input(mapping, batchId) {
  if (!mapping?.verified || !/^[a-f0-9]{16}$/.test(batchId) || !Array.isArray(mapping.changes) || !mapping.changes.length || !Array.isArray(mapping.kept)) fail();
  const seen = new Set();
  return [...mapping.changes, ...mapping.kept].map((p, n) => {
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(p.id) || seen.has(p.id.toLowerCase()) || !p.slug || !timestamp(p.expectedUpdatedAt)) fail();
    seen.add(p.id.toLowerCase());
    const replace = n < mapping.changes.length;
    if (replace && (p.action !== 'replace' || !p.expectedPreviewUrl?.startsWith(SOURCE)
      || !new RegExp(`^preview-migration-${batchId}-[a-f0-9]{24}-v1\\.png$`).test(p.targetKey)
      || p.newPreviewUrl !== TARGET + p.targetKey || !/^[a-f0-9]{64}$/.test(p.sha256))) fail();
    if (!replace && p.action !== 'keep') fail();
    return { id: p.id, slug: p.slug, action: replace ? 'replace' : 'keep', expected_url: p.expectedPreviewUrl,
      expected_updated_at: p.expectedUpdatedAt, new_url: replace ? p.newPreviewUrl : null };
  });
}
function receiptSelect(batchId, from = 'pg_temp.pp_input', condition = '') {
  return `SELECT '${batchId}'::text AS batch_id, p.id::text AS id, p.slug,\n  i.expected_url AS before_preview_url, p.product_preview_url AS after_preview_url,\n  ${stamp('p')} AS after_updated_at, ${fingerprint('p')} AS after_row_sha256\nFROM ${table} p JOIN ${from} i ON p.id = i.id\nWHERE i.action = 'replace'${condition}\nORDER BY p.id;\n`;
}
export function renderCutover(mapping, batchId) {
  const rows = input(mapping, batchId), total = rows.length, changes = mapping.changes.length;
  const source = `SELECT * FROM jsonb_to_recordset(${payload(rows)}) AS r(${fields})`;
  const preflight = '-- READ ONLY: counts must all match before considering apply. Apply rechecks under lock.\n' + transaction(true) +
    `WITH input AS (${source})\nSELECT ${changes}::integer AS expected_changes, ${total}::integer AS expected_products,\n  (SELECT count(*) FROM ${table}) AS current_products,\n  (SELECT count(*) FROM ${table} p JOIN input i ON ${beforeMatch}) AS matching_snapshot_products,\n  (SELECT count(*) FROM ${table} p JOIN input i ON ${beforeMatch} WHERE i.action = 'replace') AS matching_changes;\nCOMMIT;\n`;
  const apply = `-- OPERATOR-ONLY WRITE: exactly ${changes} preview URLs; no execution by agent.\n-- Preserve this file and receipt CSV. Do NOT run rollback without a committed receipt.\n` + transaction(false) +
    `LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE;\nCREATE TEMP TABLE pp_input ON COMMIT DROP AS ${source};\nALTER TABLE pg_temp.pp_input ADD PRIMARY KEY (id);\nCREATE TEMP TABLE pp_before ON COMMIT DROP AS\n  SELECT p.id, to_jsonb(p) AS row_before FROM ${table} p JOIN pg_temp.pp_input i ON p.id = i.id;\n` +
    `DO $pp_apply$\nDECLARE changed integer;\nBEGIN\n  IF (SELECT count(*) FROM ${table}) <> ${total}\n     OR (SELECT count(*) FROM ${table} p JOIN pg_temp.pp_input i ON ${beforeMatch}) <> ${total} THEN\n    RAISE EXCEPTION 'Cutover stopped: Catalog snapshot conflict. Nothing committed.';\n  END IF;\n  UPDATE ${table} p SET product_preview_url = i.new_url\n  FROM pg_temp.pp_input i\n  WHERE i.action = 'replace' AND ${beforeMatch};\n  GET DIAGNOSTICS changed = ROW_COUNT;\n  IF changed <> ${changes} THEN RAISE EXCEPTION 'Cutover stopped: update count mismatch. Nothing committed.'; END IF;\n  IF EXISTS (SELECT 1 FROM ${table} p JOIN pg_temp.pp_before b ON p.id = b.id\n    WHERE (to_jsonb(p) - 'product_preview_url' - 'updated_at') IS DISTINCT FROM (b.row_before - 'product_preview_url' - 'updated_at'))\n    OR (SELECT count(*) FROM ${table}) <> ${total}\n    OR (SELECT count(*) FROM ${table} p JOIN pg_temp.pp_input i ON ${afterMatch}) <> ${total}\n    OR EXISTS (SELECT 1 FROM ${table} p JOIN pg_temp.pp_input i ON p.id = i.id JOIN pg_temp.pp_before b ON p.id = b.id\n      WHERE i.action = 'keep' AND to_jsonb(p) IS DISTINCT FROM b.row_before) THEN\n    RAISE EXCEPTION 'Cutover stopped: unexpected field or URL mutation. Nothing committed.';\n  END IF;\nEND;\n$pp_apply$;\n` + receiptSelect(batchId) + 'COMMIT;\n';
  const captureReceipt = '-- READ ONLY: export receipt CSV only after confirmed successful COMMIT. Zero rows means conflict; stop.\n' + transaction(true) +
    `WITH input AS (${source})\n` + receiptSelect(batchId, 'input',
      ` AND (SELECT count(*) FROM ${table}) = ${total} AND (SELECT count(*) FROM ${table} p JOIN input i ON ${afterMatch}) = ${total}`) + 'COMMIT;\n';
  return { preflight, apply, captureReceipt };
}

export function parseReceiptCsv(text) { return parseCsv(text, RECEIPT_COLUMNS); }

export function renderRollback(mapping, batchId, receipt) {
  const all = input(mapping, batchId), expected = new Map(all.filter(r => r.action === 'replace').map(r => [r.id.toLowerCase(), r]));
  if (!Array.isArray(receipt) || receipt.length !== expected.size) fail();
  const seen = new Set();
  for (const r of receipt) {
    const e = expected.get(r.id?.toLowerCase());
    if (!e || seen.has(r.id.toLowerCase()) || r.batch_id !== batchId || r.slug !== e.slug || r.before_preview_url !== e.expected_url
      || r.after_preview_url !== e.new_url || !timestamp(r.after_updated_at) || !/^[a-f0-9]{64}$/.test(r.after_row_sha256)) fail();
    seen.add(r.id.toLowerCase());
  }
  const source = `SELECT * FROM jsonb_to_recordset(${payload(receipt)}) AS r(batch_id text, id uuid, slug text, before_preview_url text, after_preview_url text, after_updated_at timestamptz, after_row_sha256 text)`;
  const match = `p.id = i.id AND p.slug = i.slug AND p.product_preview_url = i.after_preview_url AND p.updated_at = i.after_updated_at AND ${fingerprint('p')} = i.after_row_sha256`;
  return `-- OPERATOR-ONLY ROLLBACK: receipt-based, only ${receipt.length} preview URLs. No later edits overwritten.\n` + transaction(false) +
    `LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE;\nCREATE TEMP TABLE pp_rollback ON COMMIT DROP AS ${source};\nALTER TABLE pg_temp.pp_rollback ADD PRIMARY KEY (id);\nCREATE TEMP TABLE pp_before ON COMMIT DROP AS SELECT p.id, to_jsonb(p) AS row_before FROM ${table} p JOIN pg_temp.pp_rollback i ON p.id = i.id;\n` +
    `DO $pp_rollback$\nDECLARE changed integer;\nBEGIN\n  IF (SELECT count(*) FROM ${table} p JOIN pg_temp.pp_rollback i ON ${match}) <> ${receipt.length} THEN\n    RAISE EXCEPTION 'Rollback stopped: receipt conflict or later editor change. Nothing committed.';\n  END IF;\n  UPDATE ${table} p SET product_preview_url = i.before_preview_url\n  FROM pg_temp.pp_rollback i WHERE ${match};\n  GET DIAGNOSTICS changed = ROW_COUNT;\n  IF changed <> ${receipt.length} THEN RAISE EXCEPTION 'Rollback stopped: update count mismatch. Nothing committed.'; END IF;\n  IF EXISTS (SELECT 1 FROM ${table} p JOIN pg_temp.pp_before b ON p.id = b.id\n    WHERE (to_jsonb(p) - 'product_preview_url' - 'updated_at') IS DISTINCT FROM (b.row_before - 'product_preview_url' - 'updated_at'))\n    OR EXISTS (SELECT 1 FROM ${table} p JOIN pg_temp.pp_rollback i ON p.id = i.id WHERE p.product_preview_url IS DISTINCT FROM i.before_preview_url) THEN\n    RAISE EXCEPTION 'Rollback stopped: unexpected field mutation. Nothing committed.';\n  END IF;\nEND;\n$pp_rollback$;\nSELECT ${receipt.length}::integer AS restored_preview_urls;\nCOMMIT;\n`;
}

function verifiedBatch(batchDir) {
  const summary = describeBatch(batchDir);
  if (summary.remainingFiles !== 0) fail();
  const plan = json(path.join(batchDir, 'plan.json')), progress = json(path.join(batchDir, 'progress.json'));
  const report = json(path.join(batchDir, 'verify-1-report.json')), mapping = json(path.join(batchDir, 'verify-1-cutover.json'));
  if (!report.complete || report.verifiedFiles !== summary.files || report.requests !== summary.files || report.bytes !== summary.sourceBytes || !mapping.verified) fail();
  const changes = plan.products.filter(p => p.action === 'replace').map(p => ({ ...p, sha256: progress.downloaded[p.targetKey]?.sha256 }));
  if (JSON.stringify(changes) !== JSON.stringify(mapping.changes) || JSON.stringify(plan.products.filter(p => p.action === 'keep')) !== JSON.stringify(mapping.kept)) fail();
  return { summary, plan, mapping };
}
export function prepareCutover(batchDir) {
  const { summary, plan, mapping } = verifiedBatch(batchDir);
  const scripts = renderCutover(mapping, plan.batchId), folder = path.join(batchDir, 'catalog-cutover');
  fs.mkdirSync(folder, { mode: 0o700 }); safe(folder, true);
  newFile(path.join(folder, '01-preflight-readonly.sql'), scripts.preflight);
  newFile(path.join(folder, '02-cutover.sql'), scripts.apply);
  newFile(path.join(folder, '03-capture-receipt-readonly.sql'), scripts.captureReceipt);
  newFile(path.join(folder, 'README.txt'), `PREPARED ONLY. No production SQL executed by agent.\n\n01 is READ ONLY. Expect ${summary.products} current/matching products and ${summary.replaceUrls} matching changes.\n02 is WRITE. Separate explicit operator approval required for ${summary.replaceUrls} production preview URL changes. Run whole transaction exactly once, never selected fragments. Snapshot conflict/timeout means stop, no blind retries or relaxed guards. Database advances updated_at automatically.\n03 is READ ONLY. Run after confirmed commit and export all ${summary.replaceUrls} receipt rows to a protected CSV (600), never chat/GitHub. Ambiguous timeout requires 01/03 state inspection before any repeated write.\nReturn receipt CSV path to generate guarded rollback; no real after-timestamps/fingerprints exist before cutover, so no blind rollback.sql is fabricated.\nPreserve source objects, old URLs, private original mapping and all reports. No retirement clock starts at SQL preparation.\nIntegrity verified, but partner accounting/full capacity/browser/metadata/sitemap risk gates are not cleared by this bundle. Saved $0 caps may interrupt delivery; no paid fallback or cap changes. Historical Supabase-upload guide is not rewritten/ADR superseded.\n`);
  return { stage: 'cutover-sql-prepared', replacementUrls: summary.replaceUrls, keptUrls: summary.keepUrls, filesCreated: 4, networkRequests: 0, databaseWrites: 0, rollbackRequiresCommittedReceipt: true };
}
export function prepareRollback(batchDir, receiptPath) {
  const { plan, mapping } = verifiedBatch(batchDir); safe(receiptPath);
  const file = fs.readFileSync(receiptPath); if (file.length > 1024 * 1024) fail();
  const receipt = parseReceiptCsv(file.toString('utf8'));
  const sql = renderRollback(mapping, plan.batchId, receipt);
  const folder = path.join(batchDir, 'catalog-cutover'); safe(folder, true);
  newFile(path.join(folder, '04-rollback.sql'), sql);
  return { stage: 'rollback-sql-prepared', replacementUrls: receipt.length, networkRequests: 0, databaseWrites: 0 };
}
