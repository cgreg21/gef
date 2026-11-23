import { spawnSync } from 'node:child_process';
import { access, cp, extname, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const dist = resolve(root, 'dist');
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const bundle = manifest.bundle;
if (!bundle?.name || !bundle?.id) {
  throw new Error('package.json must define bundle.name and bundle.id before creating an AppImage.');
}

const candidates = (await readdir(dist, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${bundle.name}-linux-`))
  .map((entry) => resolve(dist, entry.name));
if (candidates.length !== 1) {
  throw new Error(`Expected one node-gtk Linux bundle in ${dist}; found ${candidates.length}. Run "node-gtk bundle" first.`);
}

const portable = candidates[0];
await access(resolve(portable, 'bundle.json'));
const architecture = portable.split('-').at(-1);
const appDir = resolve(dist, `${bundle.name}.AppDir`);
const appImage = resolve(dist, `${bundle.name}-${manifest.version}-linux-${architecture}.AppImage`);
const appRoot = resolve(appDir, 'usr/lib', bundle.name);
const desktopFile = resolve(appDir, `${bundle.id}.desktop`);
const iconExtension = bundle.icon ? extname(bundle.icon) : '.svg';
const iconFile = resolve(appDir, `${bundle.id}${iconExtension}`);

await rm(appDir, { recursive: true, force: true });
await rm(appImage, { force: true });
await mkdir(appRoot, { recursive: true });
await cp(portable, appRoot, { recursive: true });

if (bundle.icon) {
  await cp(resolve(root, bundle.icon), iconFile);
} else {
  await writeFile(iconFile, '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect x="8" y="8" width="112" height="112" rx="24" fill="#3584e4"/><path d="M38 36h52v12H50v14h34v12H50v18H38z" fill="#fff"/></svg>\n');
}

await writeFile(desktopFile, [
  '[Desktop Entry]',
  'Type=Application',
  `Name=${bundle.name}`,
  `Exec=${bundle.name}`,
  `Icon=${bundle.id}`,
  'Terminal=false',
  'Categories=Development;',
  '',
].join('\n'));

await writeFile(resolve(appDir, 'AppRun'), [
  '#!/bin/sh',
  'HERE="$(dirname "$(readlink -f "$0")")"',
  `exec "$HERE/usr/lib/${bundle.name}/${bundle.name}" "$@"`,
  '',
].join('\n'));
const chmod = spawnSync('chmod', ['+x', resolve(appDir, 'AppRun')], { cwd: root, stdio: 'inherit' });
if (chmod.status !== 0) throw new Error('Unable to make AppRun executable.');

const result = spawnSync(process.env.LINUXDEPLOY ?? 'linuxdeploy', [
  '--appdir', appDir,
  '--desktop-file', desktopFile,
  '--icon-file', iconFile,
  '--output', 'appimage',
], { cwd: root, stdio: 'inherit', env: { ...process.env, APPIMAGE_EXTRACT_AND_RUN: '1' } });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error('linuxdeploy failed to create the AppImage.');

const artifacts = (await readdir(root))
  .filter((name) => name.endsWith('.AppImage'))
  .map((name) => resolve(root, name))
  .filter((path) => path !== appImage);
const artifact = artifacts[0];
if (!artifact) throw new Error('linuxdeploy did not create an AppImage in the project root.');
await cp(artifact, appImage);
await rm(artifact, { force: true });
await access(appImage);

const verify = spawnSync('file', [appImage], { encoding: 'utf8' });
if (verify.status === 0 && !verify.stdout.toLowerCase().includes('elf')) {
  throw new Error('The generated AppImage is not an ELF executable.');
}
process.stdout.write(`Created AppImage: ${appImage}\n`);
