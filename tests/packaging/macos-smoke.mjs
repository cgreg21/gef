import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

if (process.platform !== 'darwin') throw new Error('macOS package smoke test must run on macOS.');
const root = process.cwd();
const temp = await mkdtemp(resolve(tmpdir(), 'gef-macos-package-'));
const project = resolve(temp, 'project');
const packageScript = resolve(root, 'scripts/package-macos.mjs');
const app = resolve(project, 'dist/GEFSmoke.app');
const launcher = resolve(app, 'Contents/MacOS/GEFSmoke');
const dmg = resolve(project, 'dist', `GEFSmoke-macos-${process.arch}.dmg`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

try {
  await mkdir(resolve(project, 'dist'), { recursive: true });
  await symlink(resolve(root, 'node_modules'), resolve(project, 'node_modules'));
  await writeFile(resolve(project, 'package.json'), JSON.stringify({
    name: 'gef-smoke',
    version: '1.0.0',
    bundle: { name: 'GEFSmoke', id: 'com.example.GEFSmoke', entry: 'dist/main.js' },
  }));
  await writeFile(resolve(project, 'dist/main.js'), [
    "import Gtk from 'gi:Gtk-4.0';",
    "import Adw from 'gi:Adw-1';",
    "if (typeof Gtk.Window !== 'function' || typeof Adw.ApplicationWindow !== 'function') throw new Error('GTK4/libadwaita bindings are missing');",
    "console.log('macOS packaged GTK4/libadwaita runtime loaded');",
    '',
  ].join('\n'));

  run(process.execPath, [packageScript], { cwd: project });
  await readFile(dmg);
  const info = await readFile(resolve(app, 'Contents/Info.plist'), 'utf8');
  assert.match(info, /com\.example\.GEFSmoke/);
  const result = run(launcher, [], { cwd: project });
  assert.match(result, /macOS packaged GTK4\/libadwaita runtime loaded/);
  process.stdout.write('macOS standalone app and DMG runtime smoke test passed.\n');
} finally {
  await rm(temp, { recursive: true, force: true });
}
