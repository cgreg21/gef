import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await mkdtemp(resolve(tmpdir(), 'gef-appimage-'));
const project = resolve(root, 'project');
const dist = resolve(project, 'dist');
const portable = resolve(dist, 'Demo-linux-x64');
const bin = resolve(root, 'bin');
const packager = resolve(fileURLToPath(new URL('../../scripts/package-appimage.mjs', import.meta.url)));
const output = resolve(dist, 'Demo-1.0.0-linux-x64.AppImage');

try {
  await mkdir(portable, { recursive: true });
  await mkdir(bin, { recursive: true });
  await writeFile(resolve(project, 'package.json'), JSON.stringify({
    name: 'demo',
    version: '1.0.0',
    bundle: { name: 'Demo', id: 'io.example.Demo' },
  }));
  await writeFile(resolve(portable, 'bundle.json'), JSON.stringify({ name: 'Demo' }));
  await writeFile(resolve(portable, 'Demo'), '#!/bin/sh\nexit 0\n');
  await writeFile(resolve(bin, 'linuxdeploy'), [
    '#!/bin/sh',
    'while [ "$#" -gt 0 ]; do',
    '  if [ "$1" = "--appdir" ]; then APPDIR="$2"; shift 2; else shift; fi',
    'done',
    'test -x "$APPDIR/AppRun" || exit 2',
    'printf "\\177ELF\\002\\001\\001\\000" > Demo-x86_64.AppImage',
    '',
  ].join('\n'));
  await chmod(resolve(bin, 'linuxdeploy'), 0o755);

  const result = spawnSync(process.execPath, [packager], {
    cwd: project,
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  await access(output);
  await access(resolve(dist, 'Demo.AppDir/AppRun'));
  await access(resolve(dist, 'Demo.AppDir/usr/lib/Demo/Demo'));
  const desktop = await readFile(resolve(dist, 'Demo.AppDir/io.example.Demo.desktop'), 'utf8');
  assert.match(desktop, /Exec=Demo/);
  assert.match(desktop, /Icon=io\.example\.Demo/);
  process.stdout.write('AppImage staging smoke test passed.\n');
} finally {
  await rm(root, { recursive: true, force: true });
}
