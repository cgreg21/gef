import { readdir, watch } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ignored = new Set(['.git', 'node_modules', 'dist', 'coverage']);
const watchers = new Map();
let debounce;
let building = false;
let pending = false;

function runBuild() {
  if (building) { pending = true; return; }
  building = true;
  for (const script of ['build', 'package:example']) {
    const result = spawnSync('npm', ['run', script], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) break;
  }
  building = false;
  if (pending) { pending = false; runBuild(); }
}

function watchDirectory(directory) {
  if (watchers.has(directory)) return;
  try {
    const watcher = watch(directory, (_event, filename) => {
      if (filename && ignored.has(String(filename))) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => runBuild(), 150);
      if (_event === 'rename') scan(directory);
    });
    watchers.set(directory, watcher);
    scan(directory);
  } catch (error) {
    process.stderr.write(`Cannot watch ${directory}: ${error.message}\n`);
  }
}

function scan(directory) {
  readdir(directory, { withFileTypes: true }, (error, entries) => {
    if (error) return;
    for (const entry of entries) {
      if (entry.isDirectory() && !ignored.has(entry.name)) watchDirectory(join(directory, entry.name));
    }
  });
}

for (const directory of ['packages', 'scripts']) watchDirectory(join(root, directory));
process.stdout.write('GEF watch mode started. Press Ctrl+C to stop.\n');
runBuild();

function stop() {
  clearTimeout(debounce);
  for (const watcher of watchers.values()) watcher.close();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
