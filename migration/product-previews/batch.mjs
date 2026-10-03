// Operator-only; no database, upload, deployment or credential APIs.
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const SOURCE = 'https://vozvldzmzfdohusojrfq.supabase.co/storage/v1/object/public/product-previews/';
export const TARGET = 'https://pullpage-images.pullpage.workers.dev/';
export const MAX_IMAGE = 5242880;
export const CACHE = 'public, max-age=2678400, immutable, stale-if-error=0';
export const COLUMNS = ['record_type', 'source_key', 'source_bytes', 'source_mime', 'source_updated_at', 'source_etag', 'product_id', 'product_slug', 'current_preview_url', 'product_updated_at'];
const PNG = Buffer.from('89504e470d0a1a0a', 'hex');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = () => { throw new Error('Migration input or verification guard failed'); };

export function parseCsv(text, columns = COLUMNS) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell || closed) fail(); quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ''; closed = false;
      if (c !== ',') {
        if (row.some(x => x !== '')) rows.push(row);
        row = []; if (c === '\r' && text[i + 1] === '\n') i++;
      }
    } else { if (closed) fail(); cell += c; }
  }
  if (quoted) fail();
  if (cell || closed || row.length) { row.push(cell); rows.push(row); }
  if (!rows.length || rows.shift().join('\0') !== columns.join('\0')) fail();
  return rows.map(values => {
    if (values.length !== columns.length) fail();
    return Object.fromEntries(columns.map((key, i) => [key, values[i]]));
  });
}

function https(value) {
  try { const u = new URL(value); return value.trim() === value && u.protocol === 'https:' && !u.username && !u.password; }
  catch { return false; }
}
function sourceUrl(key) {
  if (!key || /[\x00-\x1f\x7f\\]/.test(key) || key.split('/').some(x => !x || x === '.' || x === '..')) fail();
  return SOURCE + key.split('/').map(encodeURIComponent).join('/');
}
const etag = value => value.trim().replace(/^W\//, '').replace(/^"|"$/g, '');

export function createPlan(records, batchId = randomBytes(8).toString('hex')) {
  if (!/^[a-f0-9]{16}$/.test(batchId)) fail();
  const objects = [], products = [], sources = new Map(), ids = new Set(), keys = new Set();
  for (const r of records) {
    if (r.record_type !== 'object') continue;
    if (!/^\d+$/.test(r.source_bytes)) fail();
    const bytes = Number(r.source_bytes);
    if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_IMAGE || r.source_mime !== 'image/png' || !/\.png$/i.test(r.source_key) || sources.has(r.source_key)) fail();
    const targetKey = `preview-migration-${batchId}-${sha(r.source_key).slice(0, 24)}-v1.png`;
    if (keys.has(targetKey)) fail(); keys.add(targetKey);
    const object = { sourceKey: r.source_key, bytes, mime: r.source_mime, sourceUpdatedAt: r.source_updated_at, sourceEtag: r.source_etag, sourceUrl: sourceUrl(r.source_key), targetKey };
    objects.push(object); sources.set(r.source_key, object);
  }
  if (!objects.length) fail();
  for (const r of records) {
    if (!['object', 'product'].includes(r.record_type)) fail();
    if (r.record_type !== 'product') continue;
    if (!r.product_id || !r.product_slug || !r.product_updated_at || !Number.isFinite(Date.parse(r.product_updated_at)) || ids.has(r.product_id)) fail();
    ids.add(r.product_id);
    const current = r.current_preview_url || null;
    const product = { id: r.product_id, slug: r.product_slug, expectedPreviewUrl: current, expectedUpdatedAt: r.product_updated_at, action: 'keep' };
    if (current !== null && !https(current)) fail();
    if (current?.startsWith(SOURCE)) {
      const suffix = current.slice(SOURCE.length);
      if (/[?#]/.test(suffix)) fail();
      let key; try { key = decodeURIComponent(suffix); } catch { fail(); }
      const object = sources.get(key); if (!object) fail();
      product.action = 'replace'; product.targetKey = object.targetKey;
      product.newPreviewUrl = TARGET + object.targetKey;
    }
    products.push(product);
  }
  const sourceBytes = objects.reduce((sum, o) => sum + o.bytes, 0);
  if (!products.length || !Number.isSafeInteger(sourceBytes)) fail();
  return { version: 1, batchId, objects, products, counts: { files: objects.length, sourceBytes, products: products.length, replaceUrls: products.filter(p => p.action === 'replace').length, keepUrls: products.filter(p => p.action === 'keep').length } };
}

function privateEntry(file, directory = false) {
  const st = fs.lstatSync(file);
  if ((directory ? !st.isDirectory() : !st.isFile()) || st.uid !== process.getuid() || (st.mode & 0o777) !== (directory ? 0o700 : 0o600)) fail();
  if (process.platform === 'darwin' && execFileSync('/bin/ls', ['-lde', file], { encoding: 'utf8' })
    .split('\n').slice(1).some(line => /^\s*\d+:/.test(line))) fail();
}
function json(file) { privateEntry(file); return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeNew(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2), { flag: 'wx', mode: 0o600 }); }
function writeState(file, data) {
  const tmp = file + '.next';
  writeNew(tmp, data); fs.renameSync(tmp, file);
}
function outsideRepo(dir) {
  const root = path.resolve(import.meta.dirname, '../..');
  let ancestor = path.resolve(dir); const parts = [];
  while (!fs.existsSync(ancestor)) { parts.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  const absolute = path.join(fs.realpathSync(ancestor), ...parts);
  const realRoot = fs.realpathSync(root);
  if (absolute === realRoot || absolute.startsWith(realRoot + path.sep)) fail();
}

export function prepareBatch(inventoryPath, batchDir, batchId) {
  outsideRepo(batchDir); privateEntry(inventoryPath);
  const bytes = fs.readFileSync(inventoryPath);
  if (bytes.length > 4 * 1024 * 1024) fail();
  const plan = createPlan(parseCsv(bytes.toString('utf8')), batchId);
  if (fs.existsSync(batchDir)) fail();
  fs.mkdirSync(batchDir, { recursive: true, mode: 0o700 }); privateEntry(batchDir, true);
  fs.mkdirSync(path.join(batchDir, 'images'), { mode: 0o700 });
  plan.inventorySha256 = sha(bytes); plan.created = new Date().toISOString();
  writeNew(path.join(batchDir, 'plan.json'), plan);
  writeNew(path.join(batchDir, 'progress.json'), { planSha256: sha(JSON.stringify(plan)), downloaded: {} });
  return { stage: 'prepared-dry-run', ...plan.counts, networkRequests: 0, credentialsRead: false, databaseWrites: 0, uploads: 0 };
}

function loadBatch(dir) {
  outsideRepo(dir); privateEntry(dir, true); privateEntry(path.join(dir, 'images'), true);
  const plan = json(path.join(dir, 'plan.json'));
  if (plan.version !== 1 || !/^[a-f0-9]{16}$/.test(plan.batchId) || !Array.isArray(plan.objects) || !Array.isArray(plan.products)) fail();
  const seen = new Set();
  for (const o of plan.objects) {
    if (o.sourceUrl !== sourceUrl(o.sourceKey) || o.mime !== 'image/png' || !Number.isSafeInteger(o.bytes) || o.bytes <= 0 || o.bytes > MAX_IMAGE
      || o.targetKey !== `preview-migration-${plan.batchId}-${sha(o.sourceKey).slice(0, 24)}-v1.png` || seen.has(o.targetKey)) fail();
    seen.add(o.targetKey);
  }
  const progress = json(path.join(dir, 'progress.json'));
  if (progress.planSha256 !== sha(JSON.stringify(plan)) || !progress.downloaded || typeof progress.downloaded !== 'object') fail();
  return { plan, progress };
}
function localFile(dir, object, record) {
  const file = path.join(dir, 'images', object.targetKey); privateEntry(file);
  const bytes = fs.readFileSync(file);
  if (bytes.length !== object.bytes || !bytes.subarray(0, 8).equals(PNG) || sha(bytes) !== record.sha256) fail();
  return file;
}

export function describeBatch(dir) {
  const { plan, progress } = loadBatch(dir);
  const pending = plan.objects.filter(o => {
    if (!progress.downloaded[o.targetKey]) { if (fs.existsSync(path.join(dir, 'images', o.targetKey))) fail(); return true; }
    localFile(dir, o, progress.downloaded[o.targetKey]); return false;
  });
  return { stage: 'dry-run', ...plan.counts, remainingFiles: pending.length, remainingBytes: pending.reduce((n, o) => n + o.bytes, 0), networkRequests: 0, credentialsRead: false, databaseWrites: 0, uploads: 0 };
}

function claim(dir, stage, attempt, objects, maxRequests, maxBytes) {
  if (!Number.isSafeInteger(attempt) || attempt < 1 || !Number.isSafeInteger(maxRequests) || !Number.isSafeInteger(maxBytes)
    || maxRequests !== objects.length || maxBytes !== objects.reduce((n, o) => n + o.bytes, 0) || !objects.length) fail();
  const prefix = path.join(dir, `${stage}-${attempt}`);
  if (fs.existsSync(prefix + '-report.json')) fail();
  writeNew(prefix + '-attempt.json', { stage, attempt, maximumRequests: maxRequests, maximumBytes: maxBytes, created: new Date().toISOString() });
  return prefix;
}

async function readPng(url, object, stage, transport, budget) {
  const expected = stage === 'download' ? object.sourceUrl : TARGET + object.targetKey;
  if (url !== expected || budget.requests >= budget.maxRequests || budget.bytes + object.bytes > budget.maxBytes) fail();
  budget.requests++;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await transport(url, { method: 'GET', redirect: 'manual', headers: { 'accept-encoding': 'identity' }, signal: controller.signal });
    const valid = response.status === 200 && response.headers.get('content-type') === 'image/png'
      && response.headers.get('content-length') === String(object.bytes) && !response.headers.has('content-encoding')
      && (stage !== 'verify' || response.headers.get('cache-control') === CACHE)
      && (stage !== 'download' || !object.sourceEtag || etag(response.headers.get('etag') || '') === etag(object.sourceEtag));
    if (!valid) { await response.body?.cancel(); fail(); }
    if (stage === 'verify' && [...response.headers.keys()].some(h => /^(x-bz-|x-amz-|authorization$|www-authenticate$|set-cookie$|location$)/i.test(h))) { await response.body?.cancel(); fail(); }
    const reader = response.body.getReader(), chunks = []; let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.byteLength; budget.bytes += value.byteLength;
        if (length > object.bytes || budget.bytes > budget.maxBytes) { controller.abort(); await reader.cancel(); fail(); }
        chunks.push(Buffer.from(value));
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    if (length !== object.bytes || !bytes.subarray(0, 8).equals(PNG)) fail();
    return { bytes, sha256: sha(bytes), cacheStatus: response.headers.get('cf-cache-status') };
  } finally { clearTimeout(timer); }
}

export async function downloadBatch({ batchDir, execute = false, attempt, maxRequests, maxBytes, transport = fetch }) {
  if (!execute) return describeBatch(batchDir);
  const { plan, progress } = loadBatch(batchDir);
  const pending = plan.objects.filter(o => {
    if (!progress.downloaded[o.targetKey]) { if (fs.existsSync(path.join(batchDir, 'images', o.targetKey))) fail(); return true; }
    localFile(batchDir, o, progress.downloaded[o.targetKey]); return false;
  });
  const prefix = claim(batchDir, 'download', attempt, pending, maxRequests, maxBytes);
  const budget = { requests: 0, bytes: 0, maxRequests, maxBytes };
  let complete = false;
  try {
    for (const o of pending) {
      const result = await readPng(o.sourceUrl, o, 'download', transport, budget);
      const file = path.join(batchDir, 'images', o.targetKey);
      fs.writeFileSync(file, result.bytes, { flag: 'wx', mode: 0o600 });
      progress.downloaded[o.targetKey] = { sha256: result.sha256, bytes: o.bytes };
      writeState(path.join(batchDir, 'progress.json'), progress);
    }
    complete = true;
  } catch { /* Fixed sanitized report; never reflect provider errors or input values. */ }
  const report = { stage: complete ? 'download-complete' : 'download-failed-stop', complete, requests: budget.requests, bytes: budget.bytes,
    downloadedFiles: Object.keys(progress.downloaded).length, expectedFiles: plan.objects.length, uploads: 0, databaseWrites: 0, created: new Date().toISOString() };
  writeNew(prefix + '-report.json', report);
  return report;
}

export async function verifyBatch({ batchDir, execute = false, attempt, maxRequests, maxBytes, transport = fetch }) {
  if (!execute) return describeBatch(batchDir);
  const { plan, progress } = loadBatch(batchDir);
  for (const o of plan.objects) { if (!progress.downloaded[o.targetKey]) fail(); localFile(batchDir, o, progress.downloaded[o.targetKey]); }
  const prefix = claim(batchDir, 'verify', attempt, plan.objects, maxRequests, maxBytes);
  const budget = { requests: 0, bytes: 0, maxRequests, maxBytes }, verified = new Map();
  let complete = false;
  try {
    for (const o of plan.objects) {
      const result = await readPng(TARGET + o.targetKey, o, 'verify', transport, budget);
      if (result.sha256 !== progress.downloaded[o.targetKey].sha256) fail();
      verified.set(o.targetKey, { sha256: result.sha256, bytes: o.bytes, cacheStatus: result.cacheStatus });
    }
    const changes = plan.products.filter(p => p.action === 'replace').map(p => {
      if (!verified.has(p.targetKey) || p.newPreviewUrl !== TARGET + p.targetKey || !p.expectedPreviewUrl?.startsWith(SOURCE)) fail();
      return { ...p, sha256: verified.get(p.targetKey).sha256 };
    });
    const kept = plan.products.filter(p => p.action === 'keep');
    writeNew(prefix + '-cutover.json', { verified: true, created: new Date().toISOString(), changes, kept,
      warning: 'Operator-only mapping, not database writes. Refresh row URL/updated_at before each change. Preserve old files. Full cutover not performed.' });
    complete = true;
  } catch { /* Failed attempts never emit cutover mapping. */ }
  const report = { stage: complete ? 'verification-complete' : 'verification-failed-stop', complete, requests: budget.requests, bytes: budget.bytes,
    verifiedFiles: verified.size, expectedFiles: plan.objects.length, databaseWrites: 0, uploads: 0, created: new Date().toISOString() };
  writeNew(prefix + '-report.json', report);
  return report;
}
