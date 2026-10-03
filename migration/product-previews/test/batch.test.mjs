import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { COLUMNS, SOURCE, TARGET, CACHE, MAX_IMAGE, parseCsv, createPlan, prepareBatch, describeBatch, downloadBatch, verifyBatch } from '../batch.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=', 'base64');
const NOW = '2026-10-03T00:00:00Z';
const obj = key => ({ record_type: 'object', source_key: key, source_bytes: String(PNG.length), source_mime: 'image/png', source_updated_at: NOW, source_etag: '', product_id: '', product_slug: '', current_preview_url: '', product_updated_at: '' });
const product = (id, url) => ({ record_type: 'product', source_key: '', source_bytes: '', source_mime: '', source_updated_at: '', source_etag: '', product_id: id, product_slug: `slug-${id}`, current_preview_url: url, product_updated_at: NOW });
function records() {
  return [obj('hello world.png'), obj('folder/ピ+%.png'),
    product('one', SOURCE + 'hello%20world.png'), product('two', SOURCE + 'folder/%E3%83%94%2B%25.png'),
    product('pilot', TARGET + 'preview-output_ariana_teamrocket_f-v1.png'), product('empty', '')];
}
const encodeCsv = records => [COLUMNS, ...records.map(r => COLUMNS.map(c => r[c] ?? ''))].map(row => row.map(v => '"' + v.replaceAll('"', '""') + '"').join(',')).join('\r\n');
function temp(rs = records()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'png-batch-')); fs.chmodSync(dir, 0o700);
  const csv = path.join(dir, 'inventory.csv'), batch = path.join(dir, 'batch');
  fs.writeFileSync(csv, encodeCsv(rs), { mode: 0o600 });
  const summary = prepareBatch(csv, batch, '0011223344556677');
  return { dir, csv, batch, summary, plan: JSON.parse(fs.readFileSync(path.join(batch, 'plan.json'), 'utf8')), cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}
function response(data = PNG, extra = {}) {
  return new Response(data, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(data.length), 'cache-control': CACHE, 'cf-cache-status': 'MISS', ...extra } });
}
const approve = (t, stage, extra = {}) => ({ batchDir: t.batch, execute: true, attempt: 1, maxRequests: t.plan.objects.length, maxBytes: t.plan.counts.sourceBytes, transport: async () => response(), ...extra });

test('CSV parser preserves quoted commas/quotes/CRLF/UTF8 and exact schema', () => {
  const rs = records(); rs[0].source_key = 'hello, "world".png';
  assert.deepEqual(parseCsv('\uFEFF' + encodeCsv(rs)), rs);
  assert.throws(() => parseCsv('wrong,column\nx,y'));
  assert.throws(() => parseCsv(COLUMNS.join(',') + '\n"unterminated'));
  assert.throws(() => parseCsv(COLUMNS.join(',') + '\n"x"junk'));
});

test('plan maps encoded legacy paths once and keeps pilot/empty previews untouched', () => {
  const plan = createPlan(records(), '0011223344556677');
  assert.deepEqual(plan.counts, { files: 2, sourceBytes: PNG.length * 2, products: 4, replaceUrls: 2, keepUrls: 2 });
  assert.equal(plan.objects[1].sourceUrl, SOURCE + 'folder/%E3%83%94%2B%25.png');
  for (const o of plan.objects) assert.match(o.targetKey, /^preview-[a-z0-9]+(?:[-_][a-z0-9]+)*-v1\.png$/);
  assert.equal(plan.products[2].action, 'keep'); assert.equal(plan.products[3].expectedPreviewUrl, null);
  const rs = [obj('a%20b.png'), product('one', SOURCE + 'a%2520b.png')];
  assert.equal(createPlan(rs, '0011223344556677').products[0].action, 'replace');
  const plus = [obj('a+b.png'), product('one', SOURCE + 'a+b.png')];
  assert.equal(createPlan(plus, '0011223344556677').products[0].action, 'replace');
});

for (const [label, change] of [
  ['WebP', r => { r[0].source_mime = 'image/webp'; }],
  ['oversized', r => { r[0].source_bytes = String(MAX_IMAGE + 1); }],
  ['zero', r => { r[0].source_bytes = '0'; }],
  ['missing-size', r => { r[0].source_bytes = ''; }],
  ['missing-source', r => { r[2].current_preview_url = SOURCE + 'missing.png'; }],
  ['duplicate-source', r => { r.push({ ...r[0] }); }],
  ['duplicate-product', r => { r.push({ ...r[2] }); }],
  ['query', r => { r[2].current_preview_url += '?download=1'; }],
  ['malformed-encoding', r => { r[2].current_preview_url = SOURCE + 'bad%ZZ.png'; }],
  ['dot-segment', r => { r[0].source_key = '../escape.png'; }],
  ['unsafe-url', r => { r[2].current_preview_url = 'https://user:password@example.org/a.png'; }],
  ['unsupported-record', r => { r[0].record_type = 'secret'; }],
]) {
  test(`rejects ${label} instead of inventing/converting/overwriting input`, () => {
    const rs = records(); change(rs); assert.throws(() => createPlan(rs, '0011223344556677'));
  });
}

test('private preparation/dry-run writes no network/upload/DB data; refuses overwrite and unsafe permissions', async () => {
  const t = temp(); try {
    assert.equal(t.summary.networkRequests, 0); assert.equal(t.summary.databaseWrites, 0);
    assert.equal(fs.statSync(path.join(t.batch, 'plan.json')).mode & 0o777, 0o600);
    assert.equal(fs.statSync(t.batch).mode & 0o777, 0o700);
    assert.throws(() => prepareBatch(t.csv, t.batch));
    assert.equal((await downloadBatch({ batchDir: t.batch, transport: () => { throw new Error('must not call'); } })).networkRequests, 0);
    assert.equal((await verifyBatch({ batchDir: t.batch, transport: () => { throw new Error('must not call'); } })).networkRequests, 0);
    fs.chmodSync(t.csv, 0o644); assert.throws(() => prepareBatch(t.csv, path.join(t.dir, 'other')));
  } finally { t.cleanup(); }
});

test('rejects output paths pointing into repository through a symlink', () => {
  const t = temp(); try {
    const link = path.join(t.dir, 'repo-link'); fs.symlinkSync(path.resolve(import.meta.dirname, '../../..'), link);
    assert.throws(() => prepareBatch(t.csv, path.join(link, 'private-leak')));
    assert.equal(fs.existsSync(path.join(link, 'private-leak')), false);
  } finally { t.cleanup(); }
});

test('download preserves original PNG bytes with explicit exact budget and one-use marker', async () => {
  const t = temp(); let calls = 0; try {
    const report = await downloadBatch(approve(t, 'download', { transport: async (url, options) => {
      calls++; assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'manual');
      assert.equal(Object.hasOwn(options.headers, 'authorization'), false); assert.equal(url.startsWith(SOURCE), true);
      return response();
    } }));
    assert.equal(report.complete, true); assert.equal(report.requests, 2); assert.equal(report.bytes, PNG.length * 2);
    for (const o of t.plan.objects) assert.deepEqual(fs.readFileSync(path.join(t.batch, 'images', o.targetKey)), PNG);
    await assert.rejects(() => downloadBatch(approve(t, 'download'))); assert.equal(calls, 2);
    assert.equal(describeBatch(t.batch).remainingFiles, 0);
  } finally { t.cleanup(); }
});

test('incorrect budget and incomplete download block transport/verification before marker', async () => {
  const t = temp(); let calls = 0; try {
    await assert.rejects(() => downloadBatch(approve(t, 'download', { maxRequests: 3, transport: () => { calls++; } })));
    await assert.rejects(() => verifyBatch(approve(t, 'verify', { transport: () => { calls++; } })));
    assert.equal(calls, 0); assert.equal(fs.existsSync(path.join(t.batch, 'download-1-attempt.json')), false);
  } finally { t.cleanup(); }
});

test('fully verified target yields private guarded mapping only, never writes database', async () => {
  const t = temp(); try {
    await downloadBatch(approve(t, 'download'));
    const report = await verifyBatch(approve(t, 'verify', { transport: async (url, options) => {
      assert.equal(url.startsWith(TARGET), true); assert.equal(options.method, 'GET'); return response();
    } }));
    assert.equal(report.complete, true); assert.equal(report.databaseWrites, 0);
    const mapping = JSON.parse(fs.readFileSync(path.join(t.batch, 'verify-1-cutover.json'), 'utf8'));
    assert.equal(mapping.changes.length, 2); assert.equal(mapping.kept.length, 2);
    assert.equal(mapping.changes[0].expectedPreviewUrl, records()[2].current_preview_url);
    assert.equal(mapping.changes[0].expectedUpdatedAt, NOW);
    assert.equal(fs.statSync(path.join(t.batch, 'verify-1-cutover.json')).mode & 0o777, 0o600);
  } finally { t.cleanup(); }
});

for (const kind of ['transport', 'redirect', 'mime', 'length', 'signature', 'truncated', 'overflow', 'etag']) {
  test(`source ${kind} stops without retry or leaked provider/input values`, async () => {
    const rs = records(); if (kind === 'etag') rs[0].source_etag = 'expected';
    const t = temp(rs); let calls = 0; try {
      const report = await downloadBatch(approve(t, 'download', { transport: async () => {
        calls++;
        if (kind === 'transport') throw new Error('SECRET_PROVIDER_TOKEN');
        if (kind === 'redirect') return new Response('SECRET_PROVIDER_TOKEN', { status: 302 });
        if (kind === 'mime') return response(PNG, { 'content-type': 'text/html' });
        if (kind === 'length') return response(PNG, { 'content-length': '999' });
        if (kind === 'signature') return response(Buffer.alloc(PNG.length));
        if (kind === 'truncated') return response(PNG.subarray(0, 9), { 'content-length': String(PNG.length) });
        if (kind === 'overflow') return response(Buffer.concat([PNG, Buffer.from([1])]), { 'content-length': String(PNG.length) });
        return response(PNG, { etag: 'different' });
      } }));
      assert.equal(report.complete, false); assert.equal(calls, 1);
      assert.doesNotMatch(JSON.stringify(report), /SECRET|hello|slug|supabase|workers\.dev/);
      assert.equal(fs.existsSync(path.join(t.batch, 'download-1-report.json')), true);
    } finally { t.cleanup(); }
  });
}

for (const kind of ['hash', 'cache', 'privacy']) {
  test(`target ${kind} mismatch cannot emit cutover mapping`, async () => {
    const t = temp(); try {
      await downloadBatch(approve(t, 'download'));
      const report = await verifyBatch(approve(t, 'verify', { transport: async () => {
        if (kind === 'hash') { const data = Buffer.from(PNG); data[20] ^= 1; return response(data); }
        if (kind === 'cache') return response(PNG, { 'cache-control': 'private' });
        return response(PNG, { 'x-bz-private': 'SECRET_PROVIDER_TOKEN' });
      } }));
      assert.equal(report.complete, false); assert.equal(report.requests, 1);
      assert.equal(fs.existsSync(path.join(t.batch, 'verify-1-cutover.json')), false);
      assert.doesNotMatch(JSON.stringify(report), /SECRET_PROVIDER_TOKEN/);
    } finally { t.cleanup(); }
  });
}

test('resume rehashes local success, preserves failed report and spends only remaining explicitly approved GET', async () => {
  const t = temp(); let firstCalls = 0, resumedCalls = 0; try {
    const first = await downloadBatch(approve(t, 'download', { transport: async () => { if (++firstCalls === 2) throw new Error('stop'); return response(); } }));
    assert.equal(first.complete, false); assert.equal(first.downloadedFiles, 1);
    const oldReport = fs.readFileSync(path.join(t.batch, 'download-1-report.json'), 'utf8');
    assert.equal(describeBatch(t.batch).remainingFiles, 1);
    const second = await downloadBatch(approve(t, 'download', { attempt: 2, maxRequests: 1, maxBytes: PNG.length, transport: async () => { resumedCalls++; return response(); } }));
    assert.equal(second.complete, true); assert.equal(resumedCalls, 1);
    assert.equal(fs.readFileSync(path.join(t.batch, 'download-1-report.json'), 'utf8'), oldReport);
    const file = path.join(t.batch, 'images', t.plan.objects[0].targetKey); fs.writeFileSync(file, Buffer.alloc(PNG.length));
    assert.throws(() => describeBatch(t.batch));
  } finally { t.cleanup(); }
});

test('changed plan or untracked local file blocks zero-network instead of silent overwrite', async () => {
  const t = temp(); try {
    const file = path.join(t.batch, 'images', t.plan.objects[0].targetKey);
    fs.writeFileSync(file, PNG, { mode: 0o600 }); assert.throws(() => describeBatch(t.batch)); fs.unlinkSync(file);
    const planPath = path.join(t.batch, 'plan.json'), plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
    plan.products[0].expectedPreviewUrl = SOURCE + 'altered.png'; fs.writeFileSync(planPath, JSON.stringify(plan));
    assert.throws(() => describeBatch(t.batch));
  } finally { t.cleanup(); }
});

test('CLI default safe, no secrets/row data; unknown execute/upload command rejected', () => {
  const cli = path.resolve(import.meta.dirname, '../cli.mjs');
  const defaultRun = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
  assert.equal(defaultRun.status, 0); assert.equal(JSON.parse(defaultRun.stdout).requests, 0);
  const bad = spawnSync(process.execPath, [cli, 'upload', '--secret', 'SECRET_PROVIDER_TOKEN'], { encoding: 'utf8' });
  assert.equal(bad.status, 1); assert.doesNotMatch(bad.stderr, /SECRET_PROVIDER_TOKEN/);
});
