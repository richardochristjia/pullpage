#!/usr/bin/env node
import { prepareBatch, describeBatch, downloadBatch, verifyBatch } from './batch.mjs';

async function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log(JSON.stringify({ dryRun: true, requests: 0, credentialsRead: false, databaseWrites: 0, uploads: 0,
      commands: ['prepare --inventory PRIVATE.csv --batch NEW_PRIVATE_DIRECTORY', 'status --batch PRIVATE_DIRECTORY',
        'download|verify --batch PRIVATE_DIRECTORY [--execute --attempt N --max-requests N --max-bytes N]'] }));
    return;
  }
  const mode = args.shift(), options = {};
  if (!['prepare', 'status', 'download', 'verify'].includes(mode)) throw 0;
  while (args.length) {
    const flag = args.shift();
    if (Object.hasOwn(options, flag)) throw 0;
    if (flag === '--execute') options[flag] = true;
    else if (['--inventory', '--batch', '--attempt', '--max-requests', '--max-bytes'].includes(flag)) {
      const value = args.shift(); if (!value || value.startsWith('--')) throw 0; options[flag] = value;
    } else throw 0;
  }
  if (!options['--batch']) throw 0;
  const allowed = mode === 'prepare' ? ['--inventory', '--batch'] : mode === 'status' ? ['--batch'] : ['--batch', '--execute', '--attempt', '--max-requests', '--max-bytes'];
  if (Object.keys(options).some(k => !allowed.includes(k))) throw 0;
  let result;
  if (mode === 'prepare') {
    if (!options['--inventory']) throw 0;
    result = prepareBatch(options['--inventory'], options['--batch']);
  } else if (mode === 'status') result = describeBatch(options['--batch']);
  else {
    const readNumber = key => /^\d+$/.test(options[key] || '') ? Number(options[key]) : undefined;
    result = await (mode === 'download' ? downloadBatch : verifyBatch)({ batchDir: options['--batch'], execute: options['--execute'] === true,
      attempt: readNumber('--attempt'), maxRequests: readNumber('--max-requests'), maxBytes: readNumber('--max-bytes') });
  }
  console.log(JSON.stringify(result));
  if (result.complete === false) process.exitCode = 1;
}
try { await main(); }
catch {
  console.error('Migration guard failed. Stop; no automatic retry. Private inputs/provider errors withheld.');
  process.exitCode = 1;
}
