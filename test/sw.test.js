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
