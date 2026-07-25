import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const failures = [];
const notes = [];

function fail(message) { failures.push(message); }
function note(message) { notes.push(message); }
function fromRoot(path) { return resolve(root, path.replace(/^\.\//, '')); }
function assertFile(path, source) {
  if (/^(?:https?:|data:|mailto:|#)/.test(path)) return;
  const clean = path.split(/[?#]/)[0];
  if (!clean || clean === '.') return;
  if (!existsSync(fromRoot(clean))) fail(`${source}: missing ${clean}`);
}
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
function pngSize(path) {
  const buffer = readFileSync(path);
  if (buffer.toString('ascii', 1, 4) !== 'PNG') throw new Error('not a PNG');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

const html = readFileSync(join(root, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) assertFile(match[1], 'index.html');
if (/\son[a-z]+\s*=/i.test(html)) fail('index.html contains an inline event handler, which violates the deployment CSP.');
if (!html.includes('rel="manifest"')) fail('index.html does not link the web app manifest.');
if (!html.includes('viewport-fit=cover')) fail('index.html is missing safe-area viewport support.');

const css = readFileSync(join(root, 'styles.css'), 'utf8');
for (const match of css.matchAll(/url\((?:["']?)([^)"']+)/g)) {
  const asset = match[1].trim();
  if (!asset.startsWith('data:')) assertFile(asset, 'styles.css');
}

const manifest = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
for (const field of ['name', 'short_name', 'start_url', 'scope', 'display', 'theme_color', 'background_color']) {
  if (!manifest[field]) fail(`manifest.webmanifest is missing ${field}.`);
}
if (!['standalone', 'fullscreen', 'minimal-ui'].includes(manifest.display)) fail('manifest display mode is not installable.');
for (const icon of manifest.icons || []) {
  assertFile(icon.src, 'manifest icon');
  const expected = icon.sizes?.match(/^(\d+)x(\d+)$/);
  if (expected && existsSync(fromRoot(icon.src))) {
    try {
      const [width, height] = pngSize(fromRoot(icon.src));
      if (width !== Number(expected[1]) || height !== Number(expected[2])) fail(`${icon.src} is ${width}x${height}, expected ${icon.sizes}.`);
    } catch (error) { fail(`${icon.src}: ${error.message}`); }
  }
}
for (const screenshot of manifest.screenshots || []) {
  assertFile(screenshot.src, 'manifest screenshot');
  const expected = screenshot.sizes?.match(/^(\d+)x(\d+)$/);
  if (expected && existsSync(fromRoot(screenshot.src))) {
    try {
      const [width, height] = pngSize(fromRoot(screenshot.src));
      if (width !== Number(expected[1]) || height !== Number(expected[2])) fail(`${screenshot.src} is ${width}x${height}, expected ${screenshot.sizes}.`);
    } catch (error) { fail(`${screenshot.src}: ${error.message}`); }
  }
}
for (const shortcut of manifest.shortcuts || []) for (const icon of shortcut.icons || []) assertFile(icon.src, 'manifest shortcut');

const serviceWorker = readFileSync(join(root, 'sw.js'), 'utf8');
if (!serviceWorker.includes("self.addEventListener('install'")) fail('sw.js has no install handler.');
if (!serviceWorker.includes("self.addEventListener('fetch'")) fail('sw.js has no fetch handler.');
if (!serviceWorker.includes("self.addEventListener('activate'")) fail('sw.js has no activate handler.');
const shellMatch = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/);
if (!shellMatch) fail('Could not find APP_SHELL in sw.js.');
else {
  for (const match of shellMatch[1].matchAll(/["']([^"']+)["']/g)) assertFile(match[1], 'sw.js APP_SHELL');
}

const sourceFiles = walk(join(root, 'src')).filter((path) => extname(path) === '.js')
  .concat([join(root, 'sw.js'), join(root, 'simulation-worker.js')]);
for (const file of sourceFiles) {
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (check.status !== 0) fail(`${relative(root, file)} syntax error: ${(check.stderr || check.stdout).trim()}`);
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/(?:from\s+|import\s*)["'](\.[^"']+)["']/g)) {
    const importPath = resolve(file, '..', match[1]);
    if (!existsSync(importPath)) fail(`${relative(root, file)} imports missing ${normalize(match[1])}`);
  }
}

const supabaseAdapter = readFileSync(join(root, 'src/supabase-adapter.js'), 'utf8');
const supabaseMigration = readFileSync(join(root, 'supabase/migrations/001_initial_schema.sql'), 'utf8');
for (const match of supabaseAdapter.matchAll(/\.rpc\(['"]([^'"]+)['"]/g)) {
  if (!supabaseMigration.includes(`function public.${match[1]}(`)) fail(`Supabase adapter RPC ${match[1]} is missing from the SQL migration.`);
}
for (const table of ['eldoria_profiles', 'eldoria_characters', 'eldoria_save_snapshots']) {
  if (!supabaseMigration.includes(`alter table public.${table} enable row level security`)) fail(`Supabase table ${table} is missing RLS enablement.`);
}

const required = [
  'src/data.js', 'src/engine.js', 'src/state.js', 'src/storage.js', 'src/supabase-adapter.js', 'src/ui.js',
  'simulation-worker.js', 'supabase/migrations/001_initial_schema.sql', 'assets/eldoria-map.png',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/maskable-192.png', 'assets/icons/maskable-512.png',
];
for (const path of required) assertFile(path, 'required project file');

if (failures.length) {
  console.error(`Validation failed with ${failures.length} problem${failures.length === 1 ? '' : 's'}:`);
  for (const problem of failures) console.error(`  - ${problem}`);
  process.exit(1);
}

note(`${sourceFiles.length} JavaScript files passed syntax validation.`);
note(`${manifest.icons?.length || 0} manifest icons and ${manifest.shortcuts?.length || 0} shortcuts validated.`);
note('Service worker, app shell, HTML, CSS, and relative assets are internally consistent.');
console.log('Eldoria project validation passed.');
for (const message of notes) console.log(`  ✓ ${message}`);
