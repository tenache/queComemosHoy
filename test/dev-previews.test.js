// The dev previews site (#44): what tools/dev-previews.mjs publishes.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { APP_FILES, indexHtml, markManifest, markTitle, run } from '../tools/dev-previews.mjs';
import { readServiceWorker } from '../tools/sw-version.js';

const SRC = fileURLToPath(new URL('../', import.meta.url));

test('APP_FILES: every file the service worker caches is published', () => {
  const { shell } = readServiceWorker();
  for (const path of shell.filter(Boolean)) {
    assert.ok(APP_FILES.some((f) => path === f || path.startsWith(`${f}/`)), `${path} would be missing from the previews`);
  }
});

test('markTitle: the tab says which preview it is; the title text is escaped', () => {
  assert.equal(markTitle('<title>¿Qué comemos hoy?</title>', 'PR 43'), '<title>PR 43 · ¿Qué comemos hoy?</title>');
  assert.equal(markTitle('<title>x</title>', '<b>'), '<title>&lt;b&gt; · x</title>');
});

test('indexHtml: open PRs newest first, then main; titles escaped', () => {
  const html = indexHtml([
    { path: 'pr/41/', number: 41, title: 'Amigos', branch: 'a', sha: 'abcdef123', updated: '1/1' },
    { path: 'pr/43/', number: 43, title: '<script>x</script>', branch: 'b', sha: '1234567890', updated: '2/1' },
    { path: 'main/', number: null, title: 'main', branch: 'main', sha: 'ffff', updated: '3/1' },
  ]);
  assert.ok(html.indexOf('PR #43') < html.indexOf('PR #41'));
  assert.ok(html.includes('&lt;script&gt;') && !html.includes('<script>x'));
  assert.ok(html.includes('href="./main/"'));
  assert.ok(indexHtml([]).includes('No hay ninguno abierto'));
});

test('run: publishes a PR, lists it, removes closed ones, and a closed PR goes', () => {
  const site = mkdtempSync(join(tmpdir(), 'qch-site-'));
  mkdirSync(join(site, 'pr', '7'), { recursive: true }); // closed long ago
  writeFileSync(join(site, 'pr', '7', 'preview.json'), '{}');
  const base = { SRC, SITE: site, TITLE: 'Despensa', BRANCH: '42-despensa', SHA: 'abc1234def' };

  run({ ...base, TARGET: 'pr', PR: '43', OPEN_PRS: '43' });
  assert.ok(existsSync(join(site, 'pr', '43', 'js', 'app.js')));
  assert.ok(existsSync(join(site, 'pr', '43', 'sw.js')));
  assert.match(readFileSync(join(site, 'pr', '43', 'index.html'), 'utf8'), /<title>PR 43 · /);
  assert.deepEqual(readdirSync(join(site, 'pr')), ['43'], 'PR 7 is not open: its folder goes');
  assert.ok(readFileSync(join(site, 'index.html'), 'utf8').includes('PR #43'));
  assert.ok(existsSync(join(site, '.nojekyll')));

  run({ ...base, TARGET: 'main', TITLE: 'main', BRANCH: 'main' }); // no OPEN_PRS: nothing removed
  assert.ok(existsSync(join(site, 'pr', '43')));
  assert.ok(readFileSync(join(site, 'index.html'), 'utf8').includes('href="./main/"'));

  run({ ...base, TARGET: 'pr', PR: '43', CLOSED: 'true', OPEN_PRS: '' });
  assert.ok(!existsSync(join(site, 'pr', '43')));
  assert.ok(readFileSync(join(site, 'index.html'), 'utf8').includes('No hay ninguno abierto'));
});

test('markManifest: an installed preview is named as one', () => {
  const m = JSON.parse(markManifest(JSON.stringify({ name: '¿Qué comemos hoy?', short_name: 'Qué comemos', start_url: './' }), 'PR 43'));
  assert.deepEqual(m, { name: 'PR 43 · ¿Qué comemos hoy?', short_name: 'PR 43', start_url: './' });
});

test('run: a PR just opened is kept even if the open list does not have it yet', () => {
  const site = mkdtempSync(join(tmpdir(), 'qch-site-'));
  run({ SRC, SITE: site, TARGET: 'pr', PR: '50', TITLE: 't', OPEN_PRS: '43' });
  assert.ok(existsSync(join(site, 'pr', '50', 'index.html')));
  assert.equal(JSON.parse(readFileSync(join(site, 'pr', '50', 'manifest.webmanifest'), 'utf8')).short_name, 'PR 50');
});

test('run: refuses a PR "number" that could point outside its folder', () => {
  const site = mkdtempSync(join(tmpdir(), 'qch-site-'));
  assert.throws(() => run({ SRC, SITE: site, TARGET: 'pr', PR: '../../etc' }), /Not a PR number/);
  assert.throws(() => run({ SRC, SITE: site, TARGET: 'nope' }), /TARGET/);
});
