// Builds the dev previews site (#44): https://quecomemoshoy-dev.github.io/
//
// Run by .github/workflows/dev-previews.yml with two folders checked out:
// `src` (this repo, at the commit to publish) and `site` (the dev site's
// repo). It copies the app into site/pr/<n>/ (a PR) or site/main/ (main),
// removes the folders of PRs that are no longer open, and writes the index.
//
//   node src/tools/dev-previews.mjs
//
// Environment: SRC, SITE (folders), TARGET ("pr" or "main"), PR, TITLE,
// BRANCH, SHA, CLOSED ("true" when the PR was closed), OPEN_PRS (the open PR
// numbers, comma-separated; when missing, nothing is removed).

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// What the app is: what a preview folder gets (everything sw.js caches, plus sw.js and params.json).
export const APP_FILES = ['index.html', 'styles.css', 'manifest.webmanifest', 'sw.js', 'params.json', 'js', 'icons'];

const escapeHtml = (text) =>
  String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The app's index.html with a title that says which preview it is ("PR 43 · ¿Qué comemos hoy?"). */
export function markTitle(html, label) {
  return html.replace(/<title>([^<]*)<\/title>/, (_, title) => `<title>${escapeHtml(label)} · ${title}</title>`);
}

/** The manifest with the preview's label in its names, so an installed preview isn't taken for the real app. */
export function markManifest(text, label) {
  const manifest = JSON.parse(text);
  manifest.name = `${label} · ${manifest.name}`;
  manifest.short_name = label;
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/** The site's front page: main, then the open PRs, newest first. `entries` = [{path, number?, title, branch, sha, updated}]. */
export function indexHtml(entries) {
  const prs = entries.filter((e) => e.number != null).sort((a, b) => b.number - a.number);
  const main = entries.find((e) => e.path === 'main/');
  const row = (e, label) => `
      <li>
        <a href="./${escapeHtml(e.path)}">${escapeHtml(label)}</a>
        <span class="title">${escapeHtml(e.title)}</span>
        <span class="meta">${escapeHtml(e.branch)} · ${escapeHtml(String(e.sha ?? '').slice(0, 7))} · ${escapeHtml(e.updated)}</span>
      </li>`;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>Vistas previas · ¿Qué comemos hoy?</title>
  <style>
    :root { color-scheme: light dark; --bg: #fff7f0; --text: #2b2118; --muted: #7a6a5c; --line: #eadfd4; --accent: #c4471f; }
    @media (prefers-color-scheme: dark) { :root { --bg: #1b1613; --text: #f6ece3; --muted: #b3a294; --line: #3a302a; --accent: #f2643d; } }
    body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.45 system-ui, sans-serif; }
    main { max-width: 560px; margin: 0 auto; padding: 24px 16px 48px; }
    h1 { font-size: 1.4rem; margin: 0 0 4px; }
    h2 { font-size: 1rem; margin: 24px 0 8px; }
    p { color: var(--muted); margin: 0 0 8px; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; flex-direction: column; gap: 2px; padding: 12px 0; border-bottom: 1px solid var(--line); }
    a { color: var(--accent); font-weight: 600; font-size: 1.05rem; }
    .meta { color: var(--muted); font-size: 0.85rem; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main>
    <h1>Vistas previas</h1>
    <p>Cada PR abierto de <a href="https://github.com/tenache/queComemosHoy/pulls">tenache/queComemosHoy</a>, para probarlo en el teléfono. Los datos de acá son de prueba, aparte de la app de verdad, y los grupos de amigos no andan.</p>
    <h2>PRs abiertos</h2>
    ${prs.length > 0 ? `<ul>${prs.map((e) => row(e, `PR #${e.number}`)).join('')}\n    </ul>` : '<p>No hay ninguno abierto.</p>'}
    <h2>main</h2>
    ${main ? `<ul>${row(main, 'main')}\n    </ul>` : '<p>Todavía no se publicó.</p>'}
  </main>
</body>
</html>
`;
}

/** What's published now: each folder's preview.json. */
function readEntries(site) {
  const entries = [];
  const read = (path) => {
    const file = join(site, path, 'preview.json');
    if (!existsSync(file)) return;
    try {
      entries.push({ ...JSON.parse(readFileSync(file, 'utf8')), path });
    } catch {
      // A broken one is left out of the index; the next publish of it writes it again.
    }
  };
  read('main/');
  if (existsSync(join(site, 'pr'))) for (const n of readdirSync(join(site, 'pr'))) read(`pr/${n}/`);
  return entries;
}

export function run(env = process.env) {
  const { SRC, SITE, TARGET, PR, TITLE, BRANCH, SHA, CLOSED, OPEN_PRS } = env;
  if (!SRC || !SITE || !['pr', 'main'].includes(TARGET)) throw new Error('SRC, SITE and TARGET (pr or main) are needed');
  if (TARGET === 'pr' && !/^\d+$/.test(PR ?? '')) throw new Error(`Not a PR number: ${PR}`);
  const folder = TARGET === 'pr' ? join('pr', PR) : 'main';
  const dest = join(SITE, folder);

  rmSync(dest, { recursive: true, force: true });
  if (CLOSED !== 'true') {
    mkdirSync(dest, { recursive: true });
    for (const name of APP_FILES) if (existsSync(join(SRC, name))) cpSync(join(SRC, name), join(dest, name), { recursive: true });
    const label = TARGET === 'pr' ? `PR ${PR}` : 'main';
    writeFileSync(join(dest, 'index.html'), markTitle(readFileSync(join(dest, 'index.html'), 'utf8'), label));
    // Installed on the phone, it says it's a preview, next to the real app.
    const manifest = join(dest, 'manifest.webmanifest');
    if (existsSync(manifest)) writeFileSync(manifest, markManifest(readFileSync(manifest, 'utf8'), label));
    const updated = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'short', timeStyle: 'short' });
    const info = { number: TARGET === 'pr' ? Number(PR) : null, title: TITLE ?? '', branch: BRANCH ?? '', sha: SHA ?? '', updated };
    writeFileSync(join(dest, 'preview.json'), `${JSON.stringify(info, null, 2)}\n`);
  }

  // PRs closed while the workflow didn't run (or before it existed): their folders go too.
  if (OPEN_PRS != null && existsSync(join(SITE, 'pr'))) {
    const open = new Set(OPEN_PRS.split(',').filter(Boolean));
    if (TARGET === 'pr' && CLOSED !== 'true') open.add(PR); // just opened: the list may not have it yet
    for (const n of readdirSync(join(SITE, 'pr'))) if (!open.has(n)) rmSync(join(SITE, 'pr', n), { recursive: true, force: true });
  }

  writeFileSync(join(SITE, 'index.html'), indexHtml(readEntries(SITE)));
  writeFileSync(join(SITE, '.nojekyll'), ''); // the files as they are, no Jekyll
  return folder;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(`Published ${run()}`);
