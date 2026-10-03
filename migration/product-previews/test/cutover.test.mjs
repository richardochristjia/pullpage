import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { SOURCE, TARGET, COLUMNS } from '../batch.mjs';
import { RECEIPT_COLUMNS, renderCutover, renderRollback, parseReceiptCsv, prepareCutover, prepareRollback } from '../cutover.mjs';
import { prepareBatch, downloadBatch, verifyBatch, CACHE } from '../batch.mjs';
const BATCH = '0011223344556677', NOW = '2026-10-01T00:00:00.123456Z';
const id = n => `00000000-0000-0000-0000-${n.toString().padStart(12, '0')}`;
const key = n => `preview-migration-${BATCH}-${n.toString().padStart(24, '0')}-v1.png`;
const product = n => ({ id: id(n), slug: `slug-${n}`, expectedPreviewUrl: SOURCE + `old-${n}.png`, expectedUpdatedAt: NOW, action: 'replace', targetKey: key(n), newPreviewUrl: TARGET + key(n), sha256: 'a'.repeat(64) });
function mapping() { return { verified: true, changes: [product(1), product(2)], kept: [{ id: id(3), slug: 'pilot', expectedPreviewUrl: TARGET + 'preview-pilot-v1.png', expectedUpdatedAt: NOW, action: 'keep' }, { id: id(4), slug: 'empty', expectedPreviewUrl: null, expectedUpdatedAt: NOW, action: 'keep' }] }; }
const csv = (rows, columns) => [columns, ...rows.map(r => columns.map(c => r[c] ?? ''))].map(r => r.map(v => '"' + String(v).replaceAll('"', '""') + '"').join(',')).join('\r\n');
function receipt(m = mapping()) { return m.changes.map(p => ({ batch_id: BATCH, id: p.id, slug: p.slug, before_preview_url: p.expectedPreviewUrl, after_preview_url: p.newPreviewUrl, after_updated_at: '2026-10-03T11:30:00.987654Z', after_row_sha256: 'b'.repeat(64) })); }

test('SQL writes only preview URL, bounded lock/timeouts, owner timestamps never assigned', () => {
  const out = renderCutover(mapping(), BATCH);
  assert.match(out.preflight, /BEGIN READ ONLY/); assert.doesNotMatch(out.preflight, /UPDATE|CREATE TEMP|LOCK TABLE/);
  assert.match(out.apply, /LOCK TABLE catalog_private\.catalog_products IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(out.apply, /lock_timeout = '5s'/); assert.match(out.apply, /statement_timeout = '30s'/);
  assert.deepEqual([...out.apply.matchAll(/UPDATE[^;]+SET\s+([a-z_]+)/g)].map(m => m[1]), ['product_preview_url']);
  assert.doesNotMatch(out.apply, /SET updated_at|DISABLE TRIGGER|DROP TABLE|DELETE FROM|ALTER TABLE catalog_private/);
  assert.match(out.apply, /p\.updated_at = i\.expected_updated_at/);
  assert.match(out.apply, /unexpected field or URL mutation/); assert.match(out.apply, /COMMIT;\s*$/);
  assert.match(out.captureReceipt, /BEGIN READ ONLY/); assert.match(out.captureReceipt, /sha256\(convert_to/);
});
for (const [name, change] of [
  ['unverified', m => { m.verified = false; }],
  ['duplicate id', m => { m.changes[1].id = m.changes[0].id; }],
  ['invalid id', m => { m.changes[0].id = "'; DROP TABLE"; }],
  ['wrong target', m => { m.changes[0].newPreviewUrl = 'https://other.invalid/a.png'; }],
  ['wrong batch', m => { m.changes[0].targetKey = 'preview-other-v1.png'; }],
  ['missing hash', m => { m.changes[0].sha256 = ''; }],
  ['missing timestamp', m => { m.changes[0].expectedUpdatedAt = ''; }],
]) test(`reject ${name} before file generation`, () => { const m = mapping(); change(m); assert.throws(() => renderCutover(m, BATCH)); });

test('receipt parser preserves quotes, commas, Unicode, embedded newlines and full microseconds', () => {
  const rs = receipt(); rs[0].slug = 'a,"b"\nピ';
  assert.deepEqual(parseReceiptCsv('\uFEFF' + csv(rs, RECEIPT_COLUMNS)), rs);
  assert.throws(() => parseReceiptCsv('wrong,header\nx,y'));
});
test('rollback cannot be fabricated from old mapping; exact committed receipt validates', () => {
  const m = mapping(), rs = receipt(m), sql = renderRollback(m, BATCH, rs);
  assert.match(sql, /p\.updated_at = i\.after_updated_at/); assert.match(sql, /after_row_sha256/);
  assert.match(sql, /SET product_preview_url = i\.before_preview_url/); assert.doesNotMatch(sql, /SET updated_at/);
  for (const mutate of [r => r.pop(), r => { r[1].id = r[0].id; }, r => { r[0].after_preview_url = SOURCE + 'wrong'; }, r => { r[0].batch_id = 'bad'; }, r => { r[0].after_row_sha256 = ''; }, r => { r[0].before_preview_url = 'https://other.invalid'; }]) {
    const bad = structuredClone(rs); mutate(bad); assert.throws(() => renderRollback(m, BATCH, bad));
  }
});
test('unverified local batch refuses SQL; verified batch privately prepared and never overwritten', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cutover-files-')); fs.chmodSync(root, 0o700);
  const bytes = Buffer.from('89504e470d0a1a0a0000000000000000', 'hex'), inventory = path.join(root, 'inventory.csv'), batch = path.join(root, 'batch');
  const records = [
    { record_type: 'object', source_key: 'a.png', source_bytes: String(bytes.length), source_mime: 'image/png' },
    { record_type: 'product', product_id: id(1), product_slug: 'a', current_preview_url: SOURCE + 'a.png', product_updated_at: NOW },
  ];
  fs.writeFileSync(inventory, csv(records, COLUMNS), { mode: 0o600 });
  try {
    prepareBatch(inventory, batch, BATCH); assert.throws(() => prepareCutover(batch));
    const opts = { batchDir: batch, execute: true, attempt: 1, maxRequests: 1, maxBytes: bytes.length, transport: async () => new Response(bytes, { headers: { 'content-type': 'image/png', 'content-length': String(bytes.length), 'cache-control': CACHE } }) };
    await downloadBatch(opts); assert.throws(() => prepareCutover(batch)); await verifyBatch(opts);
    const result = prepareCutover(batch); assert.equal(result.databaseWrites, 0); assert.equal(result.networkRequests, 0);
    const folder = path.join(batch, 'catalog-cutover'); assert.equal(fs.statSync(folder).mode & 0o777, 0o700);
    assert.equal(fs.readdirSync(folder).length, 4); for (const f of fs.readdirSync(folder)) assert.equal(fs.statSync(path.join(folder, f)).mode & 0o777, 0o600);
    assert.throws(() => prepareCutover(batch));
    const verified = JSON.parse(fs.readFileSync(path.join(batch, 'verify-1-cutover.json'), 'utf8'));
    const r = receipt(verified), rp = path.join(root, 'receipt.csv'); fs.writeFileSync(rp, csv(r, RECEIPT_COLUMNS), { mode: 0o600 });
    assert.equal(prepareRollback(batch, rp).databaseWrites, 0); assert.throws(() => prepareRollback(batch, rp));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test('CLI SQL commands refuse execute flags rather than opening any database', () => {
  const cli = path.resolve(import.meta.dirname, '../cli.mjs');
  for (const cmd of ['prepare-cutover', 'prepare-rollback']) {
    const p = spawnSync(process.execPath, [cli, cmd, '--batch', '/bad', '--execute'], { encoding: 'utf8' });
    assert.equal(p.status, 1); assert.match(p.stderr, /Stop; no automatic retry/);
  }
});

const toolsAvailable = ['initdb', 'pg_ctl', 'psql'].every(t => spawnSync('/bin/sh', ['-c', `command -v ${t}`], { encoding: 'utf8' }).status === 0);
test('real isolated PostgreSQL: atomic cutover, preservation, quoting, receipt rollback and conflict stops', { skip: !toolsAvailable, timeout: 60000 }, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-preview-')); fs.chmodSync(root, 0o700);
  const data = path.join(root, 'data'), socket = path.join(root, 'socket'); fs.mkdirSync(socket, { mode: 0o700 });
  // Explicit private Unix socket only. Never read a production URL/config or use TCP.
  const env = { PATH: process.env.PATH, HOME: root, LANG: 'C', LC_ALL: 'C' };
  const run = (cmd, args, input) => spawnSync(cmd, args, { encoding: 'utf8', env, input, timeout: 15000 });
  let running = false;
  const sql = input => run('psql', ['-X', '-q', '--csv', '-v', 'ON_ERROR_STOP=1', '-h', socket, '-U', 'operator_test', '-d', 'postgres'], input);
  const ok = input => { const r = sql(input); assert.equal(r.status, 0, r.stderr); return r.stdout; };
  const state = () => ok("SET timezone='UTC'; SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM catalog_private.catalog_products p;");
  const m = mapping(); m.changes[0].slug = "name'); DROP TABLE catalog_private.catalog_products; -- $pp_apply$ ピ";
  const literal = s => "'" + s.replaceAll("'", "''") + "'";
  function reset() {
    ok(`TRUNCATE catalog_private.catalog_products; INSERT INTO catalog_private.catalog_products (id,slug,product_preview_url,updated_at) VALUES ${[...m.changes, ...m.kept].map(p => `('${p.id}',${literal(p.slug)},${p.expectedPreviewUrl === null ? 'NULL' : literal(p.expectedPreviewUrl)},'${NOW}')`).join(',')};`);
  }
  try {
    let r = run('initdb', ['-D', data, '-U', 'operator_test', '-A', 'trust', '--no-locale', '--encoding=UTF8']); assert.equal(r.status, 0, r.stderr);
    r = run('pg_ctl', ['-D', data, '-l', path.join(root, 'server.log'), '-o', `-k ${socket} -c listen_addresses=''`, '-w', 'start']); assert.equal(r.status, 0, r.stderr); running = true;
    ok(`CREATE SCHEMA catalog_private;
CREATE TABLE catalog_private.catalog_products (id uuid PRIMARY KEY, slug text NOT NULL UNIQUE, product_preview_url text, updated_at timestamptz NOT NULL, card_name text DEFAULT 'name', is_active boolean DEFAULT true, binder_sleeve_price integer DEFAULT 120000, toploader_price integer DEFAULT 150000, created_at timestamptz DEFAULT '2026-01-01T00:00:00Z');
CREATE FUNCTION catalog_private.test_owned() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id IS DISTINCT FROM OLD.id OR NEW.slug IS DISTINCT FROM OLD.slug OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.updated_at IS DISTINCT FROM OLD.updated_at THEN RAISE EXCEPTION 'owned field mutation'; END IF; NEW.updated_at := statement_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER owned BEFORE UPDATE ON catalog_private.catalog_products FOR EACH ROW EXECUTE FUNCTION catalog_private.test_owned();`);
    reset(); const original = state(), generated = renderCutover(m, BATCH);
    assert.match(ok(generated.preflight), /2,4,4,4,2/); assert.equal(state(), original);
    const receiptRows = parseReceiptCsv(ok(generated.apply)); assert.equal(receiptRows.length, 2);
    const changed = state(); assert.notEqual(changed, original);
    assert.equal(sql(generated.apply).status, 3); assert.equal(state(), changed, 'second apply leaves current state untouched');
    const fromReadOnly = parseReceiptCsv(ok(generated.captureReceipt)); assert.deepEqual(fromReadOnly, receiptRows);
    const rollback = renderRollback(m, BATCH, fromReadOnly);
    ok(`UPDATE catalog_private.catalog_products SET binder_sleeve_price=99999 WHERE id='${id(2)}';`);
    const edited = state(); assert.equal(sql(rollback).status, 3); assert.equal(state(), edited, 'later price edit blocks rollback without any partial URL restore');
    // A fresh receipt explicitly captures current state; rollback still restores URLs ONLY, not later prices.
    const freshReceipt = parseReceiptCsv(ok(generated.captureReceipt)); ok(renderRollback(m, BATCH, freshReceipt));
    const restored = JSON.parse(ok("SELECT jsonb_agg(jsonb_build_object('id',id,'url',product_preview_url,'price',binder_sleeve_price) ORDER BY id) FROM catalog_private.catalog_products;").trim().split('\n').slice(1).join('\n').replace(/^"|"$/g, '').replaceAll('""', '"'));
    assert.equal(restored[0].url, m.changes[0].expectedPreviewUrl); assert.equal(restored[1].url, m.changes[1].expectedPreviewUrl); assert.equal(restored[1].price, 99999);
    reset(); ok(`UPDATE catalog_private.catalog_products SET card_name='later edit' WHERE id='${id(2)}';`);
    const stale = state(); assert.equal(sql(generated.apply).status, 3); assert.equal(state(), stale, 'one stale timestamp aborts entire batch');
    reset(); ok(`INSERT INTO catalog_private.catalog_products(id,slug,updated_at) VALUES('${id(5)}','new','${NOW}');`);
    const extra = state(); assert.equal(sql(generated.apply).status, 3); assert.equal(state(), extra, 'new product aborts snapshot');
    reset(); ok(`CREATE FUNCTION catalog_private.test_unexpected() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.card_name := 'unexpected'; RETURN NEW; END $$; CREATE TRIGGER unexpected BEFORE UPDATE ON catalog_private.catalog_products FOR EACH ROW EXECUTE FUNCTION catalog_private.test_unexpected();`);
    const prior = state(); assert.equal(sql(generated.apply).status, 3); assert.equal(state(), prior, 'unexpected fact mutation rolls back URLs and facts');
    ok('DROP TRIGGER unexpected ON catalog_private.catalog_products;');
    m.changes = Array.from({ length: 122 }, (_, i) => product(i + 1));
    m.kept = [{ ...mapping().kept[0], id: id(123) }, { ...mapping().kept[1], id: id(124) }];
    reset(); const scaled = renderCutover(m, BATCH);
    assert.match(ok(scaled.preflight), /122,124,124,124,122/);
    const scaledReceipt = parseReceiptCsv(ok(scaled.apply)); assert.equal(scaledReceipt.length, 122);
    const rows = JSON.parse(ok("SET timezone='UTC'; SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM catalog_private.catalog_products p;").trim().split('\n').slice(1).join('\n').replace(/^"|"$/g, '').replaceAll('""', '"'));
    assert.equal(rows[122].product_preview_url, m.kept[0].expectedPreviewUrl); assert.equal(rows[123].product_preview_url, null);
    assert.equal(rows[122].updated_at, '2026-10-01T00:00:00.123456+00:00');
    assert.equal(rows.every(r => r.binder_sleeve_price === 120000 && r.toploader_price === 150000 && r.card_name === 'name' && r.is_active), true);
    ok(renderRollback(m, BATCH, scaledReceipt));
  } finally {
    if (running) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
    fs.rmSync(root, { recursive: true, force: true });
  }
});
