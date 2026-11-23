import { spawnSync } from 'node:child_process';
import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const bundle = manifest.bundle;
if (process.platform !== 'win32') throw new Error('Windows packages must be built on a native Windows host.');
if (!bundle?.name || !bundle?.id || !bundle?.entry) throw new Error('package.json bundle.name, bundle.id and bundle.entry are required.');

const architecture = process.arch;
if (!['x64', 'arm64'].includes(architecture)) throw new Error(`Unsupported Windows architecture: ${architecture}`);
const binding = resolve(root, 'node_modules/node-gtk/lib/binding', `node-v${process.versions.modules}-win32-${architecture}`);
await access(resolve(binding, 'node_gtk.node'));
await access(resolve(binding, 'girepository-1.0'));
const output = resolve(root, 'dist');
const name = `${bundle.name}-windows-${architecture}`;
const stage = resolve(output, name);
const app = resolve(stage, 'app');
const runtime = resolve(stage, 'runtime');

await rm(stage, { recursive: true, force: true });
await rm(resolve(output, `${name}.zip`), { force: true });
await mkdir(app, { recursive: true });
await mkdir(runtime, { recursive: true });
for (const path of ['dist', 'node_modules', 'assets']) {
  try { await access(resolve(root, path)); }
  catch { if (path === 'dist' || path === 'node_modules') throw new Error(`Missing required application directory: ${path}`); else continue; }
  await cp(resolve(root, path), resolve(app, path), { recursive: true, dereference: true });
}
await cp(resolve(root, 'package.json'), resolve(app, 'package.json'));
await cp(process.execPath, resolve(runtime, 'node.exe'));

const launcher = [
  '@echo off',
  'setlocal',
  'set "HERE=%~dp0"',
  'cd /d "%HERE%app"',
  `"%HERE%runtime\\node.exe" --import node-gtk/register "${bundle.entry.replaceAll('/', '\\\\')}" %*`,
  '',
].join('\r\n');
await writeFile(resolve(stage, `${bundle.name}.cmd`), launcher);

const archive = resolve(output, `${name}.zip`);
const result = spawnSync('tar.exe', ['-a', '-c', '-f', archive, '-C', output, name], { stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error('Unable to create the Windows ZIP archive.');
await access(archive);
process.stdout.write(`Created Windows package: ${archive}\n`);
