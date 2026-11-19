// Guards the service worker's precache list and its VERSION.

import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

import { expectedVersion, readServiceWorker } from '../tools/sw-version.js';

const ROOT = new URL('../', import.meta.url);

test('sw.js: VERSION matches the app shell (a changed file forces a new version)', () => {
  const sw = readServiceWorker();
  const expected = expectedVersion(sw);
  assert.equal(
    sw.version,
    expected,
    `An app file changed, so sw.js needs a new VERSION or installed copies stay on the old one. Run: node tools/sw-version.js --write`,
  );
});

test('sw.js: every app file is in SHELL, and every SHELL file exists', () => {
  const { shell } = readServiceWorker();
  const wanted = [
    'index.html',
    'styles.css',
    'manifest.webmanifest',
    ...readdirSync(new URL('js/', ROOT)).map((f) => `js/${f}`),
    ...readdirSync(new URL('icons/', ROOT)).map((f) => `icons/${f}`),
  ];
  for (const path of wanted) assert.ok(shell.includes(path), `${path} is missing from SHELL in sw.js, so it would not work offline`);
  for (const path of shell) {
    if (path !== '') assert.ok(existsSync(new URL(path, ROOT)), `SHELL lists ${path}, which does not exist (install would fail)`);
  }
  assert.ok(shell.includes(''), "SHELL includes './' (the start URL)");
});

// #44: the PR previews live on one site, each in its own folder. Installing one must not delete another's
// cache, while the real app still clears its own old ones (including those from before "@scope").
async function activateAt(scope, keys) {
  const { readFileSync } = await import('node:fs');
  const vm = await import('node:vm');
  const handlers = {};
  const deleted = [];
  const sandbox = {
    URL,
    Promise,
    self: { registration: { scope }, addEventListener: (type, fn) => (handlers[type] = fn), clients: { claim: async () => {} } },
    caches: { keys: async () => keys, delete: async (k) => deleted.push(k) },
  };
  vm.runInNewContext(readFileSync(new URL('sw.js', ROOT), 'utf8'), sandbox);
  let done;
  handlers.activate({ waitUntil: (p) => (done = p) });
  await done;
  return deleted;
}

test('sw.js: on activate, deletes only its own old caches (one cache per folder, #44)', async () => {
  const { version } = readServiceWorker();
  const keys = [
    `qch-shell-${version}@/pr/43/`, // this one
    'qch-shell-v1-old@/pr/43/', // its old one
    'qch-shell-v1-other@/pr/45/', // another preview's
    'qch-shell-v1-old', // before #44 (only the real app had caches then)
    'something-else',
  ];
  assert.deepEqual(await activateAt('https://quecomemoshoy-dev.github.io/pr/43/', keys), ['qch-shell-v1-old@/pr/43/', 'qch-shell-v1-old']);
  const app = await activateAt('https://tenache.github.io/queComemosHoy/', ['qch-shell-v1-old', `qch-shell-${version}@/queComemosHoy/`, 'qch-shell-v1-x@/queComemosHoy/']);
  assert.deepEqual(app, ['qch-shell-v1-old', 'qch-shell-v1-x@/queComemosHoy/']);
});
