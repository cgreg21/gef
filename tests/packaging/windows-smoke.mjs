import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

if (process.platform !== 'win32') throw new Error('Windows package smoke test must run on Windows.');
const root = process.cwd();
const temp = await mkdtemp(resolve(tmpdir(), 'gef-windows-package-'));
const project = resolve(temp, 'project');
const unpacked = resolve(temp, 'unpacked');
const packageScript = resolve(root, 'scripts/package-windows.mjs');
const architecture = process.arch;
const packageName = `GEFSmoke-windows-${architecture}`;
const archive = resolve(project, 'dist', `${packageName}.zip`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

try {
  await mkdir(resolve(project, 'dist'), { recursive: true });
  await mkdir(unpacked, { recursive: true });
  await symlink(resolve(root, 'node_modules'), resolve(project, 'node_modules'), 'junction');
  await writeFile(resolve(project, 'package.json'), JSON.stringify({
    name: 'gef-smoke',
    version: '1.0.0',
    bundle: { name: 'GEFSmoke', id: 'com.example.GEFSmoke', entry: 'dist/main.js' },
  }));
  await writeFile(resolve(project, 'dist/main.js'), [
    "import Gtk from 'gi:Gtk-4.0';",
    "if (typeof Gtk.Window !== 'function') throw new Error('GTK4 Window binding is missing');",
    "console.log('Windows packaged GTK4 runtime loaded');",
    '',
  ].join('\n'));

  run(process.execPath, [packageScript], { cwd: project });
  await readFile(archive);
  run('tar.exe', ['-xf', archive, '-C', unpacked]);
  const executable = resolve(unpacked, packageName, 'GEFSmoke.exe');
  await readFile(executable);
  const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
  const result = spawnSync(executable, [], {
    cwd: unpacked,
    encoding: 'utf8',
    env: {
      SystemRoot: systemRoot,
      PATH: resolve(systemRoot, 'System32'),
      TEMP: process.env.TEMP ?? tmpdir(),
      TMP: process.env.TMP ?? tmpdir(),
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Windows packaged GTK4 runtime loaded/);
  process.stdout.write('Windows standalone EXE runtime smoke test passed.\n');
} finally {
  await rm(temp, { recursive: true, force: true });
}
