// Keeps VERSION in sw.js tied to the contents of the app shell.
//
// VERSION must end with a hash of every file in SHELL. `node --test` fails if
// it doesn't, so a release can't change the app and leave sw.js untouched
// (which would leave every installed copy on the old cached version).
//
//   node tools/sw-version.js           print the current and expected VERSION
//   node tools/sw-version.js --write   update VERSION in sw.js

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const SW = new URL('sw.js', ROOT);
const VERSION_RE = /const VERSION = '([^']*)';/;
const BINARY = /\.(png|jpg|jpeg|webp|ico|woff2?)$/;

/** {version, shell} as written in sw.js. shell = paths relative to the repo root. */
export function readServiceWorker() {
  const source = readFileSync(SW, 'utf8');
  const version = source.match(VERSION_RE)?.[1];
  const list = source.match(/const SHELL = \[([\s\S]*?)\];/)?.[1];
  if (version == null || list == null) throw new Error('sw.js: VERSION or SHELL not found');
  const shell = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1].replace(/^\.\//, ''));
  return { version, shell };
}

/** First 8 hex characters of a SHA-256 over the shell files' paths and contents. */
export function shellHash(shell) {
  const hash = createHash('sha256');
  for (const path of shell) {
    if (path === '') continue; // './' is the same response as index.html
    let content = readFileSync(new URL(path, ROOT));
    // Text files are hashed with LF endings, so a Windows checkout (CRLF) gives the same hash.
    if (!BINARY.test(path)) content = content.toString('utf8').replace(/\r\n/g, '\n');
    hash.update(`${path}\0`).update(content).update('\0');
  }
  return hash.digest('hex').slice(0, 8);
}

/** The VERSION sw.js should have: its "v<number>" prefix plus the shell hash. */
export function expectedVersion({ version, shell } = readServiceWorker()) {
  const prefix = version.match(/^[^-]+/)?.[0] ?? 'v1';
  return `${prefix}-${shellHash(shell)}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const current = readServiceWorker();
  const expected = expectedVersion(current);
  if (process.argv.includes('--write')) {
    writeFileSync(SW, readFileSync(SW, 'utf8').replace(VERSION_RE, `const VERSION = '${expected}';`));
    console.log(`sw.js: VERSION = '${expected}'`);
  } else {
    console.log(`current:  ${current.version}\nexpected: ${expected}`);
    if (current.version !== expected) process.exitCode = 1;
  }
}
